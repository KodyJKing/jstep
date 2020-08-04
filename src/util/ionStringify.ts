export default function ionStringify( obj, dentPrime = "  " ) {
    function isValueType( object ) { return typeof object != "object" || object === null }
    function inlineStringify( obj ) {
        let result: string[] = []
        function internal( obj ) {
            if ( isValueType( obj ) ) {
                result.push( JSON.stringify( obj ) )
                return
            }
            let i = 0
            if ( Array.isArray( obj ) ) {
                result.push( "[ " )
                for ( let e of obj ) {
                    if ( i++ > 0 ) result.push( "," )
                    internal( e )
                }
                result.push( " ]" )
            } else {
                result.push( "{ " )
                for ( let k in obj ) {
                    let v = obj[ k ]
                    if ( i++ > 0 )
                        result.push( ", " )
                    result.push( k + ": " )
                    internal( v )
                }
                result.push( " }" )
            }
        }
        internal( obj )
        return result.join( "" )
    }

    let parts: string[] = []
    function internal( obj, dent ) {
        let str = inlineStringify( obj )
        if ( isValueType( obj ) ) {
            parts.push( str )
            return
        }
        if ( str.length < 60 ) {
            parts.push( str )
            return
        }
        dent = dent + dentPrime
        if ( Array.isArray( obj ) ) {
            parts.push( "[]" )
            for ( let e of obj ) {
                parts.push( "\n" + dent )
                internal( e, dent )
            }
        } else {
            parts.push( "{}" )
            for ( let k in obj ) {
                let v = obj[ k ]
                parts.push( "\n" + dent + k + ": " )
                internal( v, dent )
            }
        }
    }
    internal( obj, "" )
    return parts.join( "" )
}
