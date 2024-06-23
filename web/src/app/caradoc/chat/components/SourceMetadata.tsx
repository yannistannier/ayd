import { tss } from "tss-react"
import { fr } from "@codegouvfr/react-dsfr"
import { answerModeData } from "@/app/caradoc/chat/data/answer-mode"
import AnswerMode from "@/app/caradoc/chat/interfaces/AnswerMode"

interface SourceMetadataProps {
    indexPosition: number
    answerMode: AnswerMode
    filename: string
    showIcon?: boolean
}

/**
 * Source metadata component
 * Contains the bottom description of a source which includes its position, its filename and an icon
 * @param indexPosition
 * @param answerMode
 * @param filename
 * @param showIcon
 * @constructor
 */
export default function SourceMetadata({
                                           indexPosition,
                                           answerMode,
                                           filename,
                                           showIcon = true
                                       }: SourceMetadataProps) {
    const {classes} = useStyles({mode: answerMode})
    return (
        <div className={classes.container}>
            {/* Source index position */}
            <div className={classes.indexPositionContainer}>
                <span>{`S${indexPosition}`}</span>
            </div>

            {/* Source associated file name */}
            <span className={classes.filename}>{filename}</span>
            {
                showIcon &&
                <i className={answerModeData[answerMode].icon}/>
            }
        </div>
    )
}


const useStyles = tss
    .withParams<{ mode: AnswerMode }>()
    .create(({mode}) => ({
        container: {
            display: 'flex',
            alignItems: 'center',
            marginTop: 2,
            marginBottom: 2,
            i: {
                marginLeft: 'auto',
                display: 'flex',
                opacity: .7,
                '::before': {
                    margin: 'auto',
                    width: '1.1rem',
                    height: '1.1rem',
                    color: mode === "collection" ?
                        fr.colors.decisions.text.title.blueFrance.default :
                        fr.colors.decisions.background.active.redMarianne.hover,
                }
            }
        },
        indexPositionContainer: {
            display: 'flex',
            backgroundColor: fr.colors.decisions.background.default.grey.default,
            border: `1px solid ${fr.colors.decisions.border.default.grey.default}`,
            borderRadius: '50%',
            paddingLeft: '.4rem',
            paddingRight: '.4rem',
            paddingTop: '.1rem',
            paddingBottom: '.1rem',
            fontSize: '.75rem',
            marginRight: fr.spacing('1w'),
            span: {
                margin: "auto",
            }
        },
        filename: {
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
        }
    }))