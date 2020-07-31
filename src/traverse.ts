const isValueType = value => typeof value != "object" || value == null
export function traverse( object, visitor ) {
    let { enter, leave, filter } = visitor
    function internal( value ) {
        if ( isValueType( value ) )
            return
        if ( value.type && filter && !filter( value ) )
            return
        if ( value.type && enter )
            if ( enter( value ) == traverse.stop )
                return
        for ( let key in value )
            internal( value[ key ] )
        if ( value.type && leave )
            leave( value ) || value
    }
    internal( object )
}
traverse.stop = Symbol( "stop" )