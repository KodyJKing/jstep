// // Internal functions
// function print(a) {
//     console.log(a) 
// }
// print( "Hello VM!" )

// // For loops
// let j = 100
// for ( let i = 0; i < 10; i++ )
//     console.log( j-- )

// // Ternary Expressions
// let b = 10 > 9
// let a = b ? 1 : 0
// console.log(a)

// // Closures
// function getClosure() {
//     let hidden = 42
//     return function closure() {
//         return hidden--
//     }
// }
// let counter = getClosure()
// for ( let i = 0; i < 10; i++ )
//     console.log( counter() )

// For of
// let arr = [ 1, 2, 3, 4 ]
// for ( let e of arr )
//     console.log( e )

let foo = function() { print( "Hey!" ) }
print( foo )