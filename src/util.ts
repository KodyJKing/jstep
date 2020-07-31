export function switchFunc( cases ) {
    return function( discriminant, argument ) {
        let caseHandler = cases[ discriminant ] || cases.default
        if ( caseHandler ) return caseHandler( argument )
    }
}

export function objectMap<T>( args: ( string | number )[], map: ( arg: string | number ) => T ) {
    let result: { [ name: string ]: T } = {}
    for ( let arg of args )
        result[ arg ] = map( arg )
    return result
}

export function splitTrim( str ) {
    return str.split( "," ).map( s => s.trim() )
}
