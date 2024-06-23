"use client"

import { ReactNode } from "react"
import { tss } from "tss-react"
import { fr } from "@codegouvfr/react-dsfr"

interface MainTitleProps {
    children: ReactNode
}

/**
 * This component represents the main title of any conventional page
 * @param children
 * @constructor
 */
export default function MainTitle({children}: MainTitleProps) {
    const {classes} = useStyles()

    return (
        <h1 className={classes.container}>
            {children}
        </h1>
    )
}

const useStyles = tss
    .create(() => ({
        container: {
            marginBottom: fr.spacing('6w'),
        },
    }))