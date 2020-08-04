import { switchFunc, objectMap, splitTrim } from "../util/util"

const parentKey = ".parent"
export function execute( program ) {
    let stack: any[] = []
    let returnAddresses: number[] = []
    let instructionCounter = 0
    const popArgs = count => stack.splice( stack.length - count )

    let scopes: any[] = [ { print: ( obj ) => console.log( obj ) } ]
    const peekScope = () => scopes[ scopes.length - 1 ]
    const pushScope = isChild => {
        let prevScope = peekScope()
        let scope: any = {}
        scopes.push( scope )
        if ( isChild )
            scope[ parentKey ] = prevScope
    }

    const lookup = name => {
        let scope = peekScope()
        while ( true ) {
            let value = scope[ name ]
            if ( value != undefined )
                return value
            scope = scope[ parentKey ]
            if ( scope == null )
                return undefined
        }
    }
    const lookupScope = name => {
        let scope = peekScope()
        while ( true ) {
            let value = scope[ name ]
            if ( value != undefined )
                return scope
            scope = scope[ parentKey ]
            if ( scope == null )
                return null
        }
    }

    const handler = switchFunc( {
        Literal: node => stack.push( node.value ),

        Call: node => {
            let callee = stack.pop()
            if ( typeof callee == "function" ) {
                let args = popArgs( node.argumentCount )
                stack.push( callee.call( null, ...args ) )
            }
            else {
                pushScope( false )
                peekScope()[ parentKey ] = callee.scope
                returnAddresses.push( instructionCounter )
                instructionCounter = callee.address
            }
        },

        Return: node => {
            scopes.pop()
            instructionCounter = returnAddresses.pop() as number
        },

        CreateClosure: node => {
            let scope = peekScope()
            let address = node.address
            stack.push( { type: "Closure", scope, address } )
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
            if ( !test )
                instructionCounter = node.target
        },

        Assign: node => {
            let name = node.name
            let scope = lookupScope( name )
            if ( scope != null )
                assignmentOperators[ node.operator ]( scope, name, stack.pop() )
        },

        AssignLocal: node => { peekScope()[ node.name ] = stack.pop() },

        CreateArray: node => {
            stack.push( popArgs( node.n ) )
        },

        CreateObject: node => {
            let content = popArgs( node.n * 2 )
            let result = {}
            for ( let i = 0; i < node.n; i++ ) {
                let key = content[ i * 2 ]
                let value = content[ i * 2 + 1 ]
                result[ key ] = value
            }
            stack.push( result )
        },

        Pop: node => { stack.length -= node.n },

        Load: node => stack.push( lookup( node.name ) ),

        PushScope: node => pushScope( true ),

        PopScope: node => scopes.pop(),

        Halt: node => instructionCounter = program.length,

        default: node => { throw new Error( "Missing execute handler for type: " + node.type ) }
    } )

    while ( true ) {
        let node = program[ instructionCounter++ ]
        if ( !node ) {
            // console.log( "\nProgram terminated." )
            // console.log( { stack, scopes } )
            return
        }
        handler( node.type, node )
    }
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