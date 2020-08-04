const scopeParentKey = ".parent"

export default class VM {
    program: any[] = []
    instructionCounter = 0
    returnAddresses: number[] = []

    push( value ) { }
    pop(): any { return {} }
    popN( n ): any[] { return [ {} ] }

    fetch() { return 0 }

    pushScope( isChild ) { }
    popScope() { }
    peekScope() { }
    lookupScope( name ) { }
    lookup( name ) { }

    callClosure( callee ) {
        this.pushScope( false )
        this.peekScope()[ scopeParentKey ] = callee.scope
        this.pushReturnAddress()
        this.instructionCounter = callee.address
    }

    return() {
        this.popScope()
        this.instructionCounter = this.returnAddresses.pop() as number
    }
    pushReturnAddress() { }
    returnToReturnAddress() { }
}