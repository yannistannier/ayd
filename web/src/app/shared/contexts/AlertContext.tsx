import { createContext, Dispatch, ReactNode, SetStateAction, useEffect, useMemo, useState } from "react"
import { Alert, AlertProps } from "@codegouvfr/react-dsfr/Alert"
import { tss } from "tss-react"
import { fr } from "@codegouvfr/react-dsfr"

// When the user wants automatic dismissal of the alert message,
// we'll use the following default duration if not provided
const DEFAULT_ALERT_MESSAGE_DISPLAY_DURATION = 3500

// We'll use the Partial type to make all properties of the AlertProps optional
type PartialAlertProps = Partial<AlertProps>

// We'll extend the AlertProps to add some custom properties
type CustomPartialAlertProps = PartialAlertProps & {
    autoHide?: boolean
    autoHideDuration?: number
    isOpen?: boolean
}

interface AlertContextType {
    // alert: AlertProps
    setAlert: Dispatch<SetStateAction<CustomPartialAlertProps>>
}

// We create our context
const AlertContext = createContext<AlertContextType>({} as AlertContextType)

interface AlertProviderProps {
    children: ReactNode
}

/**
 * This provider exposes a context to display alert messages
 * with the ability to automatically dismiss them after a certain duration
 * @param children
 * @constructor
 */
const AlertProvider = ({children}: AlertProviderProps) => {
    const [alert, setAlert] = useState<CustomPartialAlertProps>({} as CustomPartialAlertProps)

    // We'll create an object that will strip custom properties
    // so we provide only the original alert properties to the Alert component
    const alertProps: PartialAlertProps = useMemo(() => {
        // We extract all custom properties from the alert object
        const {
            autoHideDuration,
            autoHide,
            isOpen,
            ...alertProps
        } = alert
        alertProps.isClosed = !alert.isOpen

        // We only return the original alert properties
        return alertProps
    }, [alert])

    const {classes} = useStyles({isClosed: !alert.isOpen})

    // The react-dsfr alert does not disappear automatically after a certain time,
    // so we'll implement the automatic dismissal of the alert message ourselves
    useEffect(() => {
        if (alert.autoHide) {
            let timeout: NodeJS.Timeout

            // When a new alert message is displayed, we'll set a timeout to dismiss it after a certain duration
            if (!alert.isClosed) {
                timeout = setTimeout(() => {
                    handleClose()
                }, alert.autoHideDuration || DEFAULT_ALERT_MESSAGE_DISPLAY_DURATION)
            }

            // We should not forget to clear any existing timeout when the component unmounts
            return () => {
                timeout && clearTimeout(timeout)
            }
        }
    }, [alert])

    /**
     * This function is called when the user clicks on the close button of the alert message
     * We'll use it to reset the alert state
     */
    const handleClose = () => {
        setAlert({} as PartialAlertProps)
    }

    return (
        <AlertContext.Provider value={{
            setAlert
        }}>
            {/* Alert container */}
            <div className={classes.alert}>

                {/* Enriched alert component */}
                <Alert {...alertProps as AlertProps}
                       isClosed={!alert.isOpen}
                       closable
                       small={false}
                       title={alertProps.title!}
                       onClose={handleClose}/>
            </div>
            {children}
        </AlertContext.Provider>
    )
}

const useStyles = tss
    .withParams<{ isClosed: boolean }>()
    .create(({isClosed}) => ({
        alert: {
            position: 'fixed',
            right: fr.spacing('4w'),
            top: fr.spacing('3w'),
            zIndex: isClosed ? undefined : 1000,
            background: fr.colors.decisions.background.default.grey.default,
        },
    }))

export default AlertContext
export { AlertProvider }
