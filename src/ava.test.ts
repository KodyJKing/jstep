import test from "ava"
import ava from "ava"
// import * as escodegen from "escodegen"
// import * as estraverse from "estraverse"
import * as esprima from "esprima"
import ionStringify from "./ionStringify"

function objectMap<T>( args: ( string | number )[], map: ( arg: string | number ) => T ) {
    let result: { [ name: string ]: T } = {}
    for ( let arg of args )
        result[ arg ] = map( arg )
    return result
}

const unaryOperators = objectMap(
    "!, ~".split( "," ).map( s => s.trim() ),
    op => new Function( "a", " return " + op + "a " )
)
const binaryOperators = objectMap(
    " >, <, +, -, ==, *, /, %, ^, |, &, <<, >>".split( "," ).map( s => s.trim() ),
    op => new Function( "a", "b", " return a " + op + " b " )
)

const source0 = `
{
    // let a = 10
    // console.log(a)
    // a = a + 1
    // console.log(a)
    for (let i = 0; i < 10; i = i + 1) {
        console.log(i)
    }
}
`

function compile( ast ) {
    let program: any[] = []

    let stackSize = 0
    const scopeStack: any[] = [ {} ]
    const peekScope = () => scopeStack[ scopeStack.length - 1 ]
    const pushScope = () => scopeStack.push( Object.assign( {}, peekScope() ) )
    const declare = ( name ) => peekScope()[ name ] = stackSize
    const popScope = () => stackSize -= Object.keys( peekScope() ).length

    const addInstruction = ( node, pushes = 1, pops = 0 ) => {
        program.push( node )
        stackSize += pushes - pops
        node.stackSize = stackSize
        delete node.raw
    }

    const handlers = {
        Program: node => handlers.BlockStatement( node ),
        BlockStatement: node => {
            pushScope()
            for ( let child of node.body )
                compile( child )
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
            let stackIndex = peekScope()[ node.name ]
            if ( stackIndex == undefined ) {
                addInstruction( {
                    type: "GlobalReference",
                    name: node.name
                } )
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
                addInstruction( { type: "Pop" }, 0, 1 )
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
            if ( node.operator == "+" ) console.log( { stackSize } )
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
            let exitJumpPos = program.length
            let exitJump = { type: "JumpFalse", offset: 0 }
            addInstruction( exitJump, 0, 1 )
            compile( node.body )
            compile( node.update )
            addInstruction( {
                type: "Jump",
                offset: testPos - program.length
            }, 0 )
            exitJump.offset = program.length - exitJumpPos
            popScope()
        },
        AssignmentExpression: node => {
            compile( node.right )
            let stackIndex = peekScope()[ node.left.name ]
            addInstruction( {
                type: "Assign",
                offset: stackIndex - stackSize
            }, 0, 1 )
        }
    }

    function compile( node ) {
        let handler = handlers[ node.type ]
        if ( handler ) handler( node )
        else throw new Error( "Missing compile handler for type: " + node.type )
    }

    handlers[ ast.type ]( ast )

    return program
}

function execute( program, globals = { console } ) {
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
            stack[ stack.length + node.offset ] = stack.pop()
        },
        Pop: node => {
            stack.pop()
        }
    }

    while ( true ) {
        let node = program[ instructionCounter++ ]
        if ( !node ) break
        console.log( "#" + instructionCounter + " " + JSON.stringify( node ).replace( /[{}"]/g, "" ).replace( /,/g, ", " ).replace( /:/g, ": " ) )
        let handler = handlers[ node.type ]
        if ( handler ) handler( node )
        else throw new Error( "Missing execute handler for type: " + node.type )
        console.log( JSON.stringify( stack ) )
        console.log()
    }
}

test(
    "main",
    t => {
        let ast = esprima.parse( source0 )
        console.log( "AST: " + ionStringify( ast ) )
        console.log()
        let program = compile( ast )
        console.log( "Program: " + ionStringify( program ) )
        console.log()
        execute( program )
        t.pass()
    }
)