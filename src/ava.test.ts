import test from "ava"
import ava from "ava"
// import * as escodegen from "escodegen"
// import * as estraverse from "estraverse"
import * as esprima from "esprima"
import ionStringify from "./ionStringify"
import inspect from "./inspect"

function objectMap<T>( args: ( string | number )[], map: ( arg: string | number ) => T ) {
    let result: { [ name: string ]: T } = {}
    for ( let arg of args )
        result[ arg ] = map( arg )
    return result
}

function splitTrim( str ) {
    return str.split( "," ).map( s => s.trim() )
}

const unaryOperators = objectMap( splitTrim( "!, ~" ), op => new Function( "a", " return " + op + "a " ) )
const binaryOperators = objectMap(
    splitTrim( ">, <, +, -, ==, *, /, %, ^, |, &, <<, >>" ),
    op => new Function( "a", "b", " return a " + op + " b " )
)
const assignmentOperators = objectMap(
    splitTrim( "=, +=, -=, *=, /=, %=, ^=, |=, &=, <<=, >>=" ),
    op => new Function( "array", "index", "rightOperand", "array[index] " + op + " rightOperand" )
)

const source0 = `
for (let i = 0; i < 10; i = i + 1) 
    console.log(i)
console.log("Hello VM!")
`

function compile( ast, globals: any ) {
    let program: any[] = []

    let stackSize = 0
    const scopes: any[] = [ {} ]
    const peekScope = () => scopes[ scopes.length - 1 ]
    const pushScope = () => scopes.push( {} )
    const popScope = () => {
        let scope = scopes.pop()
        let localScopeSize = Object.keys( scope ).length
        if ( localScopeSize > 0 )
            addInstruction( {
                type: "Pop",
                n: localScopeSize,
            }, 0, localScopeSize )
    }
    const declare = name => peekScope()[ name ] = stackSize
    const lookup = name => {
        for ( let i = scopes.length - 1; i >= 0; i-- ) {
            let scope = scopes[ i ]
            let index = scope[ name ]
            if ( index != undefined )
                return index
        }
        return -1
    }


    const addInstruction = ( node, pushes = 1, pops = 0 ) => {
        program.push( node )
        stackSize += pushes - pops
        // node.stackSize = stackSize
        delete node.raw
    }

    const handlers = {
        Program: node => handlers.BlockStatement( node ),
        BlockStatement: node => {
            pushScope()
            node.body.map( compile )
            popScope()
        },
        VariableDeclaration: node => {
            for ( let declaration of node.declarations ) {
                declare( declaration.id.name )
                compile( declaration.init )
            }
        },
        Literal: node => { addInstruction( node ) },
        Identifier: node => {
            let stackIndex = lookup( node.name )
            if ( stackIndex < 0 ) {
                if ( globals[ node.name ] )
                    addInstruction( {
                        type: "GlobalReference",
                        name: node.name
                    } )
                else
                    throw new Error( "Identifier " + node.name + " not defined in scope." )
            } else {
                addInstruction( {
                    type: "StackReference",
                    offset: stackIndex - stackSize
                } )
            }
        },
        ExpressionStatement: node => {
            compile( node.expression )
            if ( node.expression.type != "AssignmentExpression" )
                addInstruction( { type: "Pop", n: 1 }, 0, 1 )
            addInstruction( { type: "Nop" }, 0, 0 )
        },
        CallExpression: node => {
            node.arguments.map( compile )
            compile( node.callee )
            let argumentCount = node.arguments.length
            addInstruction( {
                type: "Call",
                argumentCount
            }, 1, argumentCount + 1 )
        },
        MemberExpression: node => {
            compile( node.object )
            if ( !node.computed )
                compile( { type: "Literal", value: node.property.name } )
            else
                compile( node.property )
            addInstruction( {
                type: "Member"
            }, 1, 2 )
        },
        BinaryExpression: node => {
            compile( node.left )
            compile( node.right )
            addInstruction( {
                type: "Binary",
                operator: node.operator
            }, 1, 2 )
        },
        ForStatement: node => {
            pushScope()
            compile( node.init )
            let testPos = program.length
            compile( node.test )
            addInstruction( { type: "Nop" }, 0, 0 )

            let exitJumpPos = program.length
            let exitJump = { type: "JumpFalse", offset: 0 }
            addInstruction( exitJump, 0, 1 )
            compile( node.body )
            compile( node.update )
            addInstruction( { type: "Nop" }, 0, 0 )

            addInstruction( {
                type: "Jump",
                offset: testPos - program.length
            }, 0 )
            exitJump.offset = program.length - exitJumpPos
            popScope()
        },
        AssignmentExpression: node => {
            compile( node.right )
            let stackIndex = lookup( node.left.name )
            // inspect()
            addInstruction( {
                type: "Assign",
                offset: stackIndex - stackSize + 1,
                operator: node.operator
            }, 0, 1 )
        },
        // UpdateExpression: node => {
        //     let operator = node.operator[ 0 ] + "="
        //     compile( {
        //         type: "AssignmentExpression",
        //         right: node.argument,
        //         operator
        //     })
        // }
    }

    function compile( node ) {
        let handler = handlers[ node.type ]
        if ( handler ) handler( node )
        else throw new Error( "Missing compile handler for type: " + node.type )
    }

    handlers[ ast.type ]( ast )

    return program
}

function execute( program, globals: any ) {
    let stack: any[] = []
    let instructionCounter = 0

    const popArgs = count => stack.splice( stack.length - count )
    const peekStack = ( offset = -1 ) => stack[ stack.length + offset ]

    const handlers = {
        Literal: node => stack.push( node.value ),
        StackReference: node => stack.push( peekStack( node.offset ) ),
        GlobalReference: node => stack.push( globals[ node.name ] ),
        Call: node => {
            let callee = stack.pop()
            let args = popArgs( node.argumentCount )
            stack.push( callee.call( null, ...args ) )
        },
        Member: node => {
            let property = stack.pop()
            let object = stack.pop()
            stack.push( object[ property ] )
        },
        Binary: node => {
            let b = stack.pop()
            let a = stack.pop()
            let op = binaryOperators[ node.operator ]
            stack.push( op( a, b ) )
        },
        Jump: node => {
            instructionCounter += node.offset - 1
        },
        JumpFalse: node => {
            let test = stack.pop()
            if ( !test ) instructionCounter += node.offset - 1
        },
        Assign: node => {
            let index = stack.length + node.offset
            assignmentOperators[ node.operator ]( stack, index, stack.pop() )
            // stack[ stack.length + node.offset ] = stack.pop()
        },
        Pop: node => {
            stack.length -= node.n
        },
        Nop: node => { }
    }

    while ( true ) {
        let node = program[ instructionCounter++ ]
        if ( !node ) break
        let handler = handlers[ node.type ]
        if ( handler ) handler( node )
        else throw new Error( "Missing execute handler for type: " + node.type )
    }
}

test(
    "main",
    t => {
        let ast = esprima.parse( source0 )
        console.log( "AST: " + ionStringify( ast ) )
        console.log()
        let globals = { console }
        let program = compile( ast, globals )
        // console.log( "Program: " + ionStringify( program ) )
        for ( let node of program ) {
            if ( node.type == "Nop" ) {
                console.log()
                continue
            }
            console.log(
                Object.values( node )
                    .map( ( e, i ) => i == 0 ? e : JSON.stringify( e ) )
                    .join( " " )
            )
        }
        console.log()
        execute( program, globals )
        t.pass()
    }
)