import { switchFunc } from "./util"

export function compile( ast, globals: any ) {
    let program: any[] = []
    let line = 0

    const addInstruction = ( node ) => {
        node.line = line
        program.push( node )
    }

    // === label/jump tracking =====
    type jump = { target: number }
    type label = { name: string, line: number, jumps: jump[] }
    let labels: { [ key: string ]: label } = {}
    let labelCounter = 0
    function createLabel( prefix = "label" ) {
        let result = { name: prefix + labelCounter++, line: -1, jumps: [] }
        labels[ result.name ] = result
        return result
    }
    function addLabel( label ) {
        label.line = program.length
    }
    function addJumpInstruction( instruction, label ) {
        addInstruction( instruction )
        label.jumps.push( instruction )
    }
    // =============================

    function compileBlock( node ) {
        addInstruction( { type: "PushScope", child: true } )
        node.body.forEach( compile )
        addInstruction( { type: "PopScope" } )
    }

    function compileFunctionExpression( node ) {
        // Jump past body declaration.
        let bodyEndLabel = createLabel()
        addJumpInstruction( { type: "Jump" }, bodyEndLabel )

        // Add function body
        let pos = program.length
        for ( let param of node.params.reverse() )
            addInstruction( { type: "Declare", name: param.name } )
        let body = node.body.body
        body.forEach( compile )
        let last = body[ body.length - 1 ]
        if ( !last || last.type != "ReturnStatement" )
            compile( { type: "ReturnStatement" } )

        addLabel( bodyEndLabel )

        addInstruction( { type: "CreateClosure", address: pos } )
    }

    const compileHandler = switchFunc( {
        Program: compileBlock,
        BlockStatement: compileBlock,

        VariableDeclaration: node => {
            for ( let declaration of node.declarations ) {
                compile( declaration.init )
                addInstruction( { type: "Declare", name: declaration.id.name } )
            }
            line++
        },

        FunctionDeclaration: node => {
            compileFunctionExpression( node )
            addInstruction( { type: "Declare", name: node.id.name } )
            line++
        },

        FunctionExpression: node => {
            compileFunctionExpression( node )
            line++
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
            addInstruction( { type: "PushScope", child: true } )
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

        default: node => { throw new Error( "Missing compile handler for type: " + node.type ) }
    } )

    function compile( node ) {
        compileHandler( node.type, node )
    }

    compile( ast )

    for ( let key in labels ) {
        let label = labels[ key ]
        for ( let jump of label.jumps ) {
            jump.target = label.line
        }
    }

    return program
}
