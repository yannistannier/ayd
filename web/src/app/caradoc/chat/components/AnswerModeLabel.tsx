import { fr } from "@codegouvfr/react-dsfr"
import { tss } from "tss-react"
import { answerModeData } from "@/app/caradoc/chat/data/answer-mode"
import AnswerMode from "@/app/caradoc/chat/interfaces/AnswerMode"

interface AnswerModeLabelProps {
    mode: AnswerMode
}

/**
 * Label used to display the mode the chat is operating on, or the mode of the answer
 * @param mode
 * @constructor
 */
export default function AnswerModeLabel({mode}: AnswerModeLabelProps) {
    const {classes} = useStyles({mode})
    return (
        <div className={classes.container}>
            <i className={answerModeData[mode].icon}/>
            <span>{answerModeData[mode].name}</span>
        </div>
    )
}

const useStyles = tss
    .withParams<{ mode: AnswerMode }>()
    .create(({mode}) => ({
        container: {
            transform: "scale(0.85)",
            transformOrigin: 'left',
            display: "inline-flex",
            alignItems: 'center',
            backgroundColor: answerModeData[mode].backgroundColor,
            color: answerModeData[mode].color,
            fontSize: '.75rem',
            border: `1px solid ${answerModeData[mode].color}`,
            borderRadius: 16,
            paddingTop: '1px',
            paddingBottom: '1px',
            ...fr.spacing('padding', {left: '1w', right: '2w'}),
            i: {
                marginRight: fr.spacing('1v'),
                display: 'flex',
                '::before': {
                    margin: 'auto',
                    width: 20,
                    height: 20,
                }
            },
        }
    }))