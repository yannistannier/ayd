import { ReactNode } from "react"
import { tss } from "tss-react"
import { fr } from "@codegouvfr/react-dsfr"


interface FieldErrorMessageProps {
    children: ReactNode
}

/**
 * Displays an error message preceded by an error icon that mimics the DSFR one
 * @param children
 * @constructor
 */
export default function FieldErrorMessage({children}: FieldErrorMessageProps) {
    const {classes, cx} = useStyles()
    return (
        <div className={classes.container}>
            <div className={classes.icon}>
                <span className={cx('fr-icon-error-fill')} aria-hidden="true"/>
            </div>
            <div className={classes.message}>{children}</div>
        </div>
    )
}

const useStyles = tss
    .create(() => ({
        container: {
            display: 'flex',
            alignItems: 'flex-start',
            color: fr.colors.decisions.text.default.error.default,
        },
        icon: {
            marginRight: fr.spacing('1v'),
            'span::before': {
                transform: 'translateY(-3px)',
                height: '1em',
                width: '1em',
            }
        },
        message: {
            fontSize: 12,
        }
    }))