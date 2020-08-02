import test from "ava"
import * as esprima from "esprima"
import ionStringify from "./util/ionStringify"
import { compile } from "./compiler/compile"
import { execute } from "./vm/execute"
import fs from "fs"

let source = fs.readFileSync( "./test_src/source.js", { encoding: "utf-8" } )

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

        function propToString( k, v, i ) {
            if ( i == 0 ) return v
            if ( typeof v == "boolean" )
                return `[${ k } = ${ v }]`
            return v
        }

        let keys = Object.keys( node )
        lines.push(
            ( instructionNum++ + ": " ).padEnd( 4 ) + dent.join( "" ) +
            Object.values( node )
                .map( ( v, i ) => propToString( keys[ i ], v, i ) )
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
        let print = ( arg ) => console.log( arg )
        let globals = { print }
        let program = compile( ast, globals )
        // console.log( "Program: " + ionStringify( program ) )
        printProgram( program )
        console.log()
        execute( program, globals )
        t.pass()
    }
)