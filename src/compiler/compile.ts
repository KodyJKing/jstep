import { switchFunc } from "../util/util"
import ReferenceTracker from "./ReferenceTracker"

export function compile( ast, api: any ) {
    let program: any[] = []
    let line = 0

    const addInstruction = ( node ) => {
        node.line = line
        program.push( node )
    }

    let labelTracker = new ReferenceTracker()
    function createLabel() { return labelTracker.createReferent() }
    function addLabel( label ) { labelTracker.setValue( label, program.length ) }
    function addJumpInstruction( instruction, label ) {
        labelTracker.reference( label, instruction, "target" )
        addInstruction( instruction )
    }

    function compileBlock( node ) {
        addInstruction( { type: "PushScope", child: true } )
        line++
        node.body.forEach( ( n ) => { compile( n ); line++ } )
        addInstruction( { type: "PopScope" } )
    }

    function compileFunctionExpression( node ) {
        // Jump past body declaration.
        let bodyEndLabel = createLabel()
        addJumpInstruction( { type: "Jump" }, bodyEndLabel )

        // Add function body
        addInstruction( { type: "PushScope", child: true } )
        let pos = program.length
        for ( let param of node.params.reverse() )
            addInstruction( { type: "AssignLocal", name: param.name } )
        let body = node.body.body
        body.forEach( compile )
        let last = body[ body.length - 1 ]
        if ( !last || last.type != "ReturnStatement" )
            compile( { type: "ReturnStatement" } )
        addInstruction( { type: "PopScope" } )

        addLabel( bodyEndLabel )

        addInstruction( { type: "CreateClosure", address: pos } )
    }

    function compileCall( node, isNew ) {
        node.arguments.forEach( compile )
        let argumentCount = node.arguments.length
        let callee = node.callee
        if ( callee.type == "Identifier" && api.hasOwnProperty( callee.name ) ) {
            let name = callee.name
            addInstruction( {
                type: "CallExternal",
                argumentCount,
                name
            } )
        } else {
            compile( callee )
            addInstruction( {
                type: "Call",
                argumentCount,
                isNew
            } )
        }
    }

    const compileHandler = switchFunc( {
        Program: compileBlock,
        BlockStatement: compileBlock,

        VariableDeclaration: node => {
            for ( let declaration of node.declarations ) {
                compile( declaration.init )
                addInstruction( { type: "AssignLocal", name: declaration.id.name } )
            }
        },

        FunctionDeclaration: node => {
            compileFunctionExpression( node )
            addInstruction( { type: "AssignLocal", name: node.id.name } )
        },

        FunctionExpression: node => {
            compileFunctionExpression( node )
        },

        ReturnStatement: node => {
            if ( node.argument )
                compile( node.argument )
            else
                compile( { type: "Literal", value: undefined } )
            addInstruction( { type: "Return" } )
        },

        Literal: node => addInstruction( { type: "Literal", value: node.value } ),

        Identifier: node => addInstruction( {
            type: "Load",
            name: node.name
        } ),

        ExpressionStatement: node => {
            compile( node.expression )
            addInstruction( { type: "Pop", n: 1 } )
        },

        CallExpression: node => compileCall( node, false ),
        NewExpression: node => compileCall( node, true ),

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

        ConditionalExpression: node => {
            let alternateLabel = createLabel()
            let endLabel = createLabel()
            compile( node.test )
            addJumpInstruction( { type: "JumpFalse" }, alternateLabel )
            compile( node.consequent )
            addJumpInstruction( { type: "Jump" }, endLabel )
            addLabel( alternateLabel )
            compile( node.alternate )
            addLabel( endLabel )
        },

        ForStatement: node => {
            let testLabel = createLabel()
            let exitLabel = createLabel()

            addInstruction( { type: "PushScope", child: true } )
            compile( node.init )

            addLabel( testLabel )
            compile( node.test )

            addJumpInstruction( { type: "JumpFalse" }, exitLabel )

            compile( node.body )
            compile( node.update )
            addInstruction( { type: "Pop", n: 1 } )

            addJumpInstruction( { type: "Jump" }, testLabel )

            addLabel( exitLabel )
            addInstruction( { type: "PopScope" } )
        },

        AssignmentExpression: node => {
            compile( node.right )
            addInstruction( {
                type: "Assign",
                name: node.left.name,
                operator: node.operator,
                prefix: node.prefix
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
                operator,
                prefix: node.prefix
            } )
        },

        ArrayExpression: node => {
            node.elements.forEach( compile )
            addInstruction( { type: "CreateArray", n: node.elements.length } )
        },

        ObjectExpression: node => {
            for ( let prop of node.properties ) {
                let key = prop.key
                if ( key.type == "Identifier" )
                    addInstruction( { type: "Literal", value: key.name } )
                else
                    compile( key )
                compile( prop.value )
            }
            addInstruction( { type: "CreateObject", n: node.properties.length } )
        },

        default: node => { throw new Error( "Missing compile handler for type: " + node.type ) }
    } )

    function compile( node ) {
        compileHandler( node.type, node )
    }

    /* Add api wrappers. */ {
        let endLabel = createLabel()
        addJumpInstruction( { type: "Jump" }, endLabel )
        for ( let name in api ) {
            let func = api[ name ]
            let argumentCount = func.length
            addInstruction( {
                type: "CallExternal",
                argumentCount,
                name
            } )
            addInstruction( {
                type: "AssignLocal",
                name
            } )
        }
        addLabel( endLabel )
    }

    compile( ast )

    labelTracker.resolveAll()

    return program
}
