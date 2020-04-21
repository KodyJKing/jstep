import test from "ava"
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
    op => new Function( "object", "property", "rightOperand", "object[property] " + op + " rightOperand" )
)

let source1 = `
    function print(a) { 
        console.log(a) 
    }
    print( "Hello VM!" )
    let j = 100
    for ( let i = 0; i < 10; i++ )
        print( j-- )
`

let source0 = `
    function foo() {
        function bar(a) {
            console.log(a)
        }
        return bar
    }
    let b = foo()
    console.log(b)
    b("What?")
`

function compile( ast, globals: any ) {
    let program: any[] = []

    let line = 0

    const addInstruction = ( node ) => {
        node.line = line
        program.push( node )
        delete node.raw
    }

    const handlers = {
        Program: node => handlers.BlockStatement( node ),
        BlockStatement: node => {
            addInstruction( { type: "PushScope" } )
            node.body.forEach( compile )
            addInstruction( { type: "PopScope" } )
        },
        VariableDeclaration: node => {
            for ( let declaration of node.declarations ) {
                compile( declaration.init )
                addInstruction( { type: "Declare", name: declaration.id.name } )
            }
            line++
        },
        FunctionDeclaration: node => {
            let jump = { type: "Jump", target: 0 }
            addInstruction( jump )
            let pos = program.length
            addInstruction( { type: "PushScope" } )
            for ( let param of node.params.reverse() )
                addInstruction( { type: "Declare", name: param.name } )
            let body = node.body.body
            body.forEach( compile )
            let last = body[ body.length - 1 ]
            if ( last.type != "ReturnStatement" ) compile( { type: "ReturnStatement" } )
            addInstruction( { type: "PopScope" } )
            jump.target = program.length
            addInstruction( { type: "Literal", value: pos } )
            addInstruction( { type: "Declare", name: node.id.name } )
            line++
        },
        ReturnStatement: node => {
            if ( node.argument )
                compile( node.argument )
            else
                compile( { type: "Literal", value: undefined } )
            addInstruction( { type: "Return" } )
        },
        Literal: node => addInstruction( node ),
        Identifier: node => addInstruction( {
            type: "Load",
            name: node.name
        } ),
        ExpressionStatement: node => {
            compile( node.expression )
            addInstruction( { type: "Pop", n: 1 } )
            line++
        },
        CallExpression: node => {
            node.arguments.forEach( compile )
            compile( node.callee )
            let argumentCount = node.arguments.length
            addInstruction( {
                type: "Call",
                argumentCount
            } )
        },
        MemberExpression: node => {
            compile( node.object )
            if ( !node.computed )
                compile( { type: "Literal", value: node.property.name } )
            else
                compile( node.property )
            addInstruction( {
                type: "Member"
            } )
        },
        BinaryExpression: node => {
            compile( node.left )
            compile( node.right )
            addInstruction( {
                type: "Binary",
                operator: node.operator
            } )
        },
        ForStatement: node => {
            addInstruction( { type: "PushScope" } )
            compile( node.init )
            let testPos = program.length
            compile( node.test )

            let exitJump = { type: "JumpFalse", target: 0 }
            addInstruction( exitJump )
            line++

            compile( node.body )
            compile( node.update )
            addInstruction( { type: "Pop", n: 1 } )
            line++

            addInstruction( {
                type: "Jump",
                target: testPos
            } )
            exitJump.target = program.length
            addInstruction( { type: "PopScope" } )
            line++
        },
        AssignmentExpression: node => {
            compile( node.right )
            // inspect()
            addInstruction( {
                type: "Assign",
                name: node.left.name,
                operator: node.operator
            } )
        },
        UpdateExpression: node => {
            let operator = node.operator[ 0 ] + "="
            compile( {
                type: "AssignmentExpression",
                left: node.argument,
                right: {
                    type: "Literal",
                    value: 1
                },
                operator
            } )
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

function execute( program, globals: any ) {
    let stack: any[] = []
    let returnAddresses: number[] = []
    let instructionCounter = 0
    const popArgs = count => stack.splice( stack.length - count )

    let scopes: any[] = [ globals ]
    const peekScope = () => scopes[ scopes.length - 1 ]
    const lookup = name => {
        for ( let i = scopes.length - 1; i >= 0; i-- ) {
            let scope = scopes[ i ]
            let value = scope[ name ]
            if ( value != undefined )
                return value
        }
        return undefined
    }

    const handlers = {
        Literal: node => stack.push( node.value ),
        Call: node => {
            let callee = stack.pop()
            if ( typeof callee == "function" ) {
                let args = popArgs( node.argumentCount )
                stack.push( callee.call( null, ...args ) )
            } else {
                returnAddresses.push( instructionCounter )
                instructionCounter = callee
            }
        },
        Return: node => {
            scopes.pop()
            instructionCounter = returnAddresses.pop() as number
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
        Jump: node => { instructionCounter = node.target },
        JumpFalse: node => {
            let test = stack.pop()
            if ( !test ) instructionCounter = node.target
        },
        Assign: node => {
            let name = node.name
            for ( let i = scopes.length - 1; i >= 0; i-- ) {
                let scope = scopes[ i ]
                let value = scope[ name ]
                if ( value != undefined ) {
                    assignmentOperators[ node.operator ]( scope, name, stack.pop() )
                    stack.push( scope[ name ] )
                    return
                }
            }
        },
        Declare: node => { peekScope()[ node.name ] = stack.pop() },
        Pop: node => { stack.length -= node.n },
        Load: node => stack.push( lookup( node.name ) ),
        PushScope: node => scopes.push( {} ),
        PopScope: node => scopes.pop()
    }

    while ( true ) {
        let node = program[ instructionCounter++ ]
        if ( !node ) {
            // console.log( "\nProgram terminated." )
            // console.log( { stack, scopes } )
            return
        }
        let handler = handlers[ node.type ]
        if ( handler ) handler( node )
        else throw new Error( "Missing execute handler for type: " + node.type )
    }
}

function printProgram( program ) {
    let dent: string[] = []
    let lines: string[] = []
    let lastLineNum = 0
    let instructionNum = 0
    let toggle = true
    for ( let node of program ) {
        let line = node.line
        delete node.line
        if ( lastLineNum != line ) {
            lastLineNum = line
            lines.push( "" )
            toggle = !toggle
        }

        if ( node.type == "PopScope" )
            dent.pop()

        lines.push(
            ( instructionNum++ + ": " ).padEnd( 4 ) + dent.join( "" ) +
            Object.values( node )
                .map( ( e, i ) => i == 0 ? e : JSON.stringify( e ) )
                .join( " " )
        )

        if ( node.type == "PushScope" )
            dent.push( "    " )
    }

    console.log( lines.join( "\n" ) )
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
        printProgram( program )
        console.log()
        execute( program, globals )
        t.pass()
    }
)