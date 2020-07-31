import test from "ava"
import * as esprima from "esprima"
import ionStringify from "./ionStringify"
import inspect from "./inspect"
import { compile } from "./compile"
import { execute } from "./execute"

let source = `
    // function print(a) { 
    //     console.log(a) 
    // }
    // print( "Hello VM!" )
    // let j = 100
    // for ( let i = 0; i < 10; i++ )
    //     print( j-- )

    function foo() {
        function bar(a) {
            return 42
        }
        return bar
    }
    let b = foo()
    console.log(b())

    // let b = 10 > 9
    // let a = b ? 1 : 0
    // console.log(a)
`

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
        let ast = esprima.parse( source )
        console.log( "AST: " + ionStringify( ast ).replace( /"/g, "" ) )
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