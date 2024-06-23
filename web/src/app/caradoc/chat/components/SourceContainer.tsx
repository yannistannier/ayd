import { tss } from "tss-react"
import { fr } from "@codegouvfr/react-dsfr"
import { ReactNode, SyntheticEvent } from "react"
import AnswerMode from "@/app/caradoc/chat/interfaces/AnswerMode";

interface SourceContainerProps {
    children: ReactNode
    answerMode: AnswerMode
    handleClick: (e: SyntheticEvent) => void
}

/**
 * Wrapper around a source component
 * @param children
 * @param answerMode
 * @param handleClick
 * @constructor
 */
export default function SourceContainer({
                                            children,
                                            answerMode,
                                            handleClick,
                                        }: SourceContainerProps) {
    const {classes} = useStyles({mode: answerMode})
    return (
        <div className={classes.container} onClick={handleClick}>
            {children}
        </div>
    )
}

const sourceContainerHeight = 102

const useStyles = tss
    .withParams<{ mode: AnswerMode }>()
    .create(({mode}) => ({
        container: {
            height: sourceContainerHeight,
            maxWidth: '100%',
            backgroundColor: mode === "collection" ?
                fr.colors.decisions.background.contrast.blueFrance.default :
                fr.colors.decisions.background.contrast.redMarianne.default,
            borderRadius: 8,
            padding: fr.spacing('1w'),
            cursor: 'pointer',
            fontSize: '.85rem',
            ":hover": {
                backgroundColor: mode === "collection" ?
                    fr.colors.decisions.background.alt.blueFrance.hover :
                    fr.colors.decisions.background.alt.redMarianne.hover,
            },
        },
    }))