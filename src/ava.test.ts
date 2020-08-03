import test from "ava"
import * as esprima from "esprima"
import ionStringify from "./util/ionStringify"
import { compile } from "./compiler/compile"
import { execute } from "./vm/execute"
import fs from "fs"
import { startDivider, endDivider } from "./util/consoleDividers"
import { printProgram } from "./printProgram"

test(
    "main",
    t => {
        let source = fs.readFileSync( "./test_src/source.js", { encoding: "utf-8" } )
        let ast = esprima.parse( source )

        startDivider( "Program AST" )
        console.log( ionStringify( ast ).replace( /"/g, "" ) )
        endDivider()

        let print = ( arg ) => console.log( arg )
        let globals = { print }
        let program = compile( ast, globals )
        // console.log( "Program: " + ionStringify( program ) )

        startDivider( "Compiled Program" )
        printProgram( program )
        endDivider()

        startDivider( "Program output" )
        execute( program, globals )
        endDivider()

        t.pass()
    }
)