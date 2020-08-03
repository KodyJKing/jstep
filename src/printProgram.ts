export function printProgram( program ) {
    let dent: string[] = []
    let lines: string[] = []
    let instructionNum = 0
    for ( let node of program ) {
        if ( node.type == "PopScope" )
            dent.pop()

        function propToString( k, v, i ) {
            if ( i == 0 )
                return v
            if ( typeof v == "boolean" )
                return `[${ k } = ${ v }]`
            return v
        }

        let keys = Object.keys( node )
        lines.push(
            ( instructionNum++ + ": " ).padEnd( 4 ) + dent.join( "" ) +
            Object.values( node )
                .map( ( v, i ) => propToString( keys[ i ], v, i ) )
                .join( " " )
        )

        if ( node.type == "PushScope" )
            dent.push( "    " )
    }

    console.log( lines.join( "\n" ) )
}
