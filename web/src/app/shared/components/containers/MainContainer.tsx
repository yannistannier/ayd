"use client"

import { ReactNode } from "react"
import { tss } from "tss-react"
import { fr } from "@codegouvfr/react-dsfr"

interface MainContainerProps {
    children: ReactNode
}

/**
 * This component represents the main container of any conventional page
 * @param children
 * @constructor
 */
export default function MainContainer({children}: MainContainerProps) {
    const {classes, cx} = useStyles()
    return (
        <div className={cx('fr-container', classes.container)}>
            {children}
        </div>
    )
}

const useStyles = tss
    .create(() => ({
        container: {
            ...fr.spacing('margin', {top: '6w', bottom: '10w'}),
        },
    }))