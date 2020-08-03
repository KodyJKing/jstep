export function startDivider( label?) {
    let line = "\n============================================="
    let lineChars = line.split( "" )
    let labelChars = ( " " + label + " " ).split( "" )
    lineChars.splice( 4, labelChars.length, ...labelChars )
    console.log( lineChars.join( "" ) )
}

export function endDivider() {
    console.log( "=============================================\n" )
}