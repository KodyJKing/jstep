import VM from "./VM"
import { objectMap, splitTrim } from "../util/util"

const unaryOperators = objectMap( splitTrim( "!, ~" ), op => new Function( "a", " return " + op + "a " ) )
const binaryOperators = objectMap(
    splitTrim( ">, <, +, -, ==, *, /, %, ^, |, &, <<, >>" ),
    op => new Function( "a", "b", " return a " + op + " b " ) )
const assignmentOperators = objectMap(
    splitTrim( "=, +=, -=, *=, /=, %=, ^=, |=, &=, <<=, >>=" ),
    op => new Function( "object", "property", "rightOperand", "object[property] " + op + " rightOperand" ) )

type Instruction = ( ( vm: VM ) => void ) & { code: number }

const Instructions = {
    // (@value) => any
    Literal: ( vm: VM ) => vm.push( vm.fetch() ),

    // (@numArgs, @isNew, callee) => any
    Call: ( vm: VM ) => {
        let numArgs = vm.fetch()
        let isNew = vm.fetch()
        let callee = vm.pop()
        if ( typeof callee == "function" ) {
            let args = vm.popN( numArgs )
            if ( isNew )
                vm.push( new callee( ...args ) )
            else
                vm.push( callee.call( null, ...args ) )
        } else {
            if ( isNew ) throw new Error( "User class constructors are not supported!" )
            vm.callClosure( callee )
        }
    },

    Return: ( vm: VM ) => vm.return(),

    // (@address) => function
    CreateClosure: ( vm: VM ) => {
        let address = vm.fetch()
        let scope = vm.peekScope()
        vm.push( { type: "Closure", scope, address } )
    },

    // (object, property) => any
    Member: ( vm: VM ) => {
        let property = vm.pop()
        let object = vm.pop()
        vm.push( object[ property ] )
    },

    // (a, b) => number
    Binary: ( vm: VM ) => {
        let operator = vm.fetch()
        let b = vm.pop()
        let a = vm.pop()
        vm.push( binaryOperators[ operator ]( a, b ) )
    },

    // (@address) => void
    Jump: ( vm: VM ) => { vm.instructionCounter = vm.fetch() },

    // (@address, test) => void
    JumpFalse: ( vm: VM ) => {
        let target = vm.fetch()
        let test = vm.pop()
        if ( !test )
            vm.instructionCounter = target
    },

    // (@name, @operator, value) => void
    Assign: ( vm: VM ) => {
        let name = vm.fetch()
        let operator = vm.fetch()
        let value = vm.pop()
        let scope = vm.lookupScope( name )
        if ( scope != null )
            assignmentOperators[ operator ]( scope, name, value )
    },

    // (@name, value) => void
    AssignLocal: ( vm: VM ) => {
        let name = vm.fetch()
        let value = vm.pop()
        vm.peekScope()[ name ] = value
    },

    // (@numValues, ...values) => any[]
    CreateArray: ( vm: VM ) => {
        let numValues = vm.fetch()
        vm.push( vm.popN( numValues ) )
    },

    // (@numEntries, ...keysAndValues) => any
    CreateObject: ( vm: VM ) => {
        let numEntries = vm.fetch()
        let content = vm.popN( numEntries * 2 )
        let result = {}
        for ( let i = 0; i < numEntries; i++ ) {
            let key = content[ i * 2 ]
            let value = content[ i * 2 + 1 ]
            result[ key ] = value
        }
        vm.push( result )
    },

    // (valueToDiscard) => void
    Pop: ( vm: VM ) => { vm.pop() },

    // (@name) => any
    Load: ( vm: VM ) => {
        let name = vm.fetch()
        vm.push( vm.lookup( name ) )
    },

    // () => void
    PushScope: ( vm: VM ) => vm.pushScope( true ),

    // () => void
    PopScope: ( vm: VM ) => vm.popScope(),

    // () => void
    Halt: ( vm: VM ) => vm.instructionCounter = vm.program.length
}

let instructions: Instruction[] = []
for ( let name in Instructions ) {
    let func = Instructions[ name ]
    let code = instructions.length
    func.code = code
    instructions[ code ] = func
}

export default ( Instructions as unknown ) as { [ name: string ]: Instruction }
export function getInstruction( code: number ) { return instructions[ code ] }