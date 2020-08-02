function toposort( nodes, edges ) {
    let result = []
    let visited = new Set()
    let parents = new Map()
    for ( let edge of edges ) {
        let parent = edge[ 0 ]
        let child = edge[ 1 ]
        if ( !parents.has( child ) ) parents.set( child, [] )
        parents.get( child ).push( parent )
    }

    function addAncestors( node, path = new Set() ) {
        if ( path.has( node ) )
            throw new Error( 'Cyclic graph: ' + Array.from( path.values() ).reverse().join( ' -> ' ) )
        else if ( visited.has( node ) )
            return

        visited.add( node )
        path.add( node )

        let parentList = parents.get( node )
        if ( parentList )
            for ( let parent of parentList )
                addAncestors( parent, path )

        result.push( node )
        path.delete( node )
    }

    for ( let node of nodes )
        addAncestors( node )

    return result
}

function test( nodesStr, edgesStr ) {
    let nodes = nodesStr.replace( / /g, '' ).split( ',' )
    let edges = edgesStr.replace( / /g, '' ).split( ',' ).map( ( s ) => s.split( '->' ) )
    let sorted = toposort( nodes, edges )
    console.log( sorted )
}

{
    // OK
    let nodesStr = 'a, b, c, d, e, f, g'
    let edgesStr = 'a -> b, a -> c, b -> d, c -> e, d -> f, e -> f, f -> g'
    test( nodesStr, edgesStr )

    // Cyclic
    nodesStr = 'a, b, c'
    edgesStr = 'a -> b, b -> c, c -> a'
    test( nodesStr, edgesStr )
}