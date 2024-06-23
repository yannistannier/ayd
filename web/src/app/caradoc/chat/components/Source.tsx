import { tss } from "tss-react"
import { fr } from "@codegouvfr/react-dsfr"
import SourceInterface from "../interfaces/Source"
import SourceMetadata from "@/app/caradoc/chat/components/SourceMetadata"
import SourceContainer from "@/app/caradoc/chat/components/SourceContainer"
import AnswerMode from "@/app/caradoc/chat/interfaces/AnswerMode"

interface SourceProps {
    source: SourceInterface
    indexPosition: number
    answerMode: AnswerMode
    handleClick: () => void
}

/**
 * Displays the content of a source and some of its metadata
 * @param source
 * @param indexPosition
 * @param answerMode
 * @param handleClick
 * @constructor
 */
export default function Source({
                                   source,
                                   indexPosition,
                                   answerMode,
                                   handleClick
                               }: SourceProps) {
    const {classes} = useStyles()

    return (
        <SourceContainer answerMode={answerMode} handleClick={handleClick}>
            {/* Source's content */}
            <span className={classes.content}>{source.content}</span>

            {/* Source index position and filename */}
            <SourceMetadata indexPosition={indexPosition}
                            answerMode={answerMode}
                            filename={source.file.name}/>
        </SourceContainer>
    )
}


const useStyles = tss
    .create(() => ({
        content: {
            display: '-webkit-box',
            'WebkitBoxOrient': 'vertical',
            'WebkitLineClamp': 2,
            overflow: 'hidden',
            marginBottom: fr.spacing('1v'),
        },
    }))