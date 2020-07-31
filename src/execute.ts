import { switchFunc, objectMap, splitTrim } from "./util"

const unaryOperators = objectMap( splitTrim( "!, ~" ), op => new Function( "a", " return " + op + "a " ) )
export const binaryOperators = objectMap(
    splitTrim( ">, <, +, -, ==, *, /, %, ^, |, &, <<, >>" ),
    op => new Function( "a", "b", " return a " + op + " b " )
)

export const assignmentOperators = objectMap(
    splitTrim( "=, +=, -=, *=, /=, %=, ^=, |=, &=, <<=, >>=" ),
    op => new Function( "object", "property", "rightOperand", "object[property] " + op + " rightOperand" )
)

export function execute( program, globals: any ) {
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

    const handler = switchFunc( {
        Literal: node => stack.push( node.value ),
        Call: node => {
            let callee = stack.pop()
            if ( typeof callee == "function" ) {
                let args = popArgs( node.argumentCount )
                stack.push( callee.call( null, ...args ) )
            }
            else {
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
            if ( !test )
                instructionCounter = node.target
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
        PopScope: node => scopes.pop(),
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
