/**
 * This exception derives from the AbortException and adds metadata to it
 */
export class CustomAbortDOMException extends DOMException {
    severity: string
    title: string
    trigger: string

    constructor(message: DOMException['message'], title: string, severity: string, trigger: string) {
        super(message, "Abort")
        this.severity = severity
        this.title = title
        this.trigger = trigger
    }
}