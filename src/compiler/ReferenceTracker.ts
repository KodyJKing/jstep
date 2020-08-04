type ResolveCallback<T> = ( value: T ) => void
type Referent<T> = { id: number, description?: string, value?: T, callbacks: ResolveCallback<T>[] }
export default class ReferenceTracker<T> {
    cleanupAfterResolution = true
    referents: Referent<T>[] = []
    createReferent( description?: string ) {
        let id = this.referents.length
        let callbacks: ResolveCallback<T>[] = []
        let result = { id, description, callbacks }
        this.referents.push( result )
        return id
    }
    setValue( referentId: number, value: T ) {
        this.referents[ referentId ].value = value
    }
    reference( referentId: number, callback ) {
        this.referents[ referentId ].callbacks.push( callback )
    }
    private resolve( referent: Referent<T> ) {
        if ( !referent.value )
            throw new Error( "Referent cannot be resolved. It has not been assigned a value." )
        for ( let ref of referent.callbacks )
            ref( referent.value )
        if ( this.cleanupAfterResolution )
            referent.callbacks = []
    }
    resolveAll() {
        for ( let referent of this.referents )
            this.resolve( referent )
    }
}