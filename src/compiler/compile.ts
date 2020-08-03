import { switchFunc, switchMap } from "../util/util"
import ReferenceTracker from "./ReferenceTracker"

export function compile( ast ) {
    let program: any[] = []
    let defferedSteps: ( Function )[] = []

    const addInstruction = ( node ) => { program.push( node ) }

    let labelTracker = new ReferenceTracker()
    function createLabel() { return labelTracker.createReferent() }
    function addLabel( label ) { labelTracker.setValue( label, program.length ) }
    function addJumpInstruction( instruction, label ) {
        labelTracker.reference( label, instruction, "target" )
        addInstruction( instruction )
    }

    function compileBlock( node ) {
        addInstruction( { type: "PushScope" } )
        node.body.forEach( compileNode )
        addInstruction( { type: "PopScope" } )
    }

    function compileFunctionExpression( node ) {
        let bodyLabel = createLabel()

        // Add the function body later, we don't want the body inlined.
        defferedSteps.push( () => {
            addLabel( bodyLabel )
            for ( let param of node.params.reverse() )
                addInstruction( { type: "AssignLocal", name: param.name } )
            let body = node.body.body
            body.forEach( compileNode )
            let last = body[ body.length - 1 ]
            if ( !last || last.type != "ReturnStatement" )
                compileNode( { type: "ReturnStatement" } )
        } )

        let closureInstruction = { type: "CreateClosure" }
        labelTracker.reference( bodyLabel, closureInstruction, "address" )
        addInstruction( closureInstruction )
    }

    function compileCall( node, isNew ) {
        node.arguments.forEach( compileNode )
        let argumentCount = node.arguments.length
        compileNode( node.callee )
        addInstruction( {
            type: "Call",
            argumentCount,
            isNew
        } )
    }

    function compileNode( node ) { compileHandler( node.type, node ) }
    const compileHandler = switchFunc( {
        Program: compileBlock,
        BlockStatement: compileBlock,

        VariableDeclaration: node => {
            for ( let declaration of node.declarations ) {
                compileNode( declaration.init )
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
                compileNode( node.argument )
            else
                compileNode( { type: "Literal", value: undefined } )
            addInstruction( { type: "Return" } )
        },

        Literal: node => addInstruction( { type: "Literal", value: node.value } ),

        Identifier: node => addInstruction( {
            type: "Load",
            name: node.name
        } ),

        ExpressionStatement: node => {
            compileNode( node.expression )
            addInstruction( { type: "Pop", n: 1 } )
        },

        CallExpression: node => compileCall( node, false ),
        NewExpression: node => compileCall( node, true ),

        MemberExpression: node => {
            compileNode( node.object )
            if ( !node.computed )
                compileNode( { type: "Literal", value: node.property.name } )
            else
                compileNode( node.property )
            addInstruction( {
                type: "Member"
            } )
        },

        BinaryExpression: node => {
            compileNode( node.left )
            compileNode( node.right )
            addInstruction( {
                type: "Binary",
                operator: node.operator
            } )
        },

        ConditionalExpression: node => {
            let alternateLabel = createLabel()
            let endLabel = createLabel()
            compileNode( node.test )
            addJumpInstruction( { type: "JumpFalse" }, alternateLabel )
            compileNode( node.consequent )
            addJumpInstruction( { type: "Jump" }, endLabel )
            addLabel( alternateLabel )
            compileNode( node.alternate )
            addLabel( endLabel )
        },

        ForStatement: node => {
            let testLabel = createLabel()
            let exitLabel = createLabel()

            addInstruction( { type: "PushScope" } )
            compileNode( node.init )

            addLabel( testLabel )
            compileNode( node.test )

            addJumpInstruction( { type: "JumpFalse" }, exitLabel )

            compileNode( node.body )
            compileNode( node.update )
            addInstruction( { type: "Pop", n: 1 } )

            addJumpInstruction( { type: "Jump" }, testLabel )

            addLabel( exitLabel )
            addInstruction( { type: "PopScope" } )
        },

        AssignmentExpression: node => {
            compileNode( node.right )
            addInstruction( {
                type: "Assign",
                name: node.left.name,
                operator: node.operator,
                prefix: node.prefix
            } )
        },

        UpdateExpression: node => {
            let operator = node.operator[ 0 ] + "="
            compileNode( {
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
            node.elements.forEach( compileNode )
            addInstruction( { type: "CreateArray", n: node.elements.length } )
        },

        ObjectExpression: node => {
            for ( let prop of node.properties ) {
                let key = prop.key
                if ( key.type == "Identifier" )
                    addInstruction( { type: "Literal", value: key.name } )
                else
                    compileNode( key )
                compileNode( prop.value )
            }
            addInstruction( { type: "CreateObject", n: node.properties.length } )
        },

        default: node => { throw new Error( "Missing compile handler for type: " + node.type ) }
    } )

    compileNode( ast )
    addInstruction( { type: "Halt" } )
    while ( defferedSteps.length > 0 )
        ( defferedSteps.pop() as () => void )()

    labelTracker.resolveAll()

    return program
}
