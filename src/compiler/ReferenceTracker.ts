type Reference = { object: any, key: string }
type Referent<T> = { id: number, description?: string, value?: T, references: Reference[] }
export default class ReferenceTracker<T> {
    cleanupAfterResolution = true
    referents: Referent<T>[] = []
    createReferent( description?: string ) {
        let id = this.referents.length
        let references: Reference[] = []
        let result = { id, description, references }
        this.referents.push( result )
        return id
    }
    setValue( referentId: number, value: T ) {
        this.referents[ referentId ].value = value
    }
    reference( referentId: number, object: any, key: string ) {
        this.referents[ referentId ].references.push( { object, key } )
    }
    private resolve( referent: Referent<T> ) {
        for ( let ref of referent.references )
            ref.object[ ref.key ] = referent.value
        if ( this.cleanupAfterResolution )
            referent.references = []
    }
    resolveAll() {
        for ( let referent of this.referents )
            this.resolve( referent )
    }
}