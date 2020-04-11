import test from "ava"
import ava from "ava"
import * as escodegen from "escodegen"
import * as estraverse from "estraverse"
import * as esprima from "esprima"

test(
    "main",
    t => {
        let ast = esprima.parse( `console.log("Hello esprima!")` )
        let state = []
        let peekState = () => state[ state.length - 1 ]
        estraverse.replace(
            ast,
            {
                enter: ( node ) => {
                    if ( node.type == "MemberExpression" )
                        return estraverse.VisitorOption.Skip
                    console.log( node.type )
                    console.log( "   " )
                },
                leave: ( node ) => { }
            }
        )
        t.pass()
    }
)