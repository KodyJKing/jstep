import inspector from "inspector"
export default function inspect() {
    inspector.open( undefined, undefined, true )
    debugger
}