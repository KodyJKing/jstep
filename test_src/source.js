// // Api wrappers
// print( "Hello VM!" )

// // For loops
// let j = 100
// for ( let i = 0; i < 10; i++ )
//     print( j-- )

// // Ternary Expressions
// let b = 10 > 9
// let a = b ? 1 : 0
// print(a)

// Closures
function getClosure() {
    let hidden = 42
    return function closure() {
        return hidden--
    }
}
let counter = getClosure()
for ( let i = 0; i < 10; i++ )
    print( counter() )

// For of
// let arr = [ 1, 2, 3, 4 ]
// for ( let e of arr )
//     print( e )

// let foo = function() { print( "Hey!" ) }
// print( foo )