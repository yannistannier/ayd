import { tss } from "tss-react"
import { fr } from "@codegouvfr/react-dsfr"

interface StepInstructionProps {
    index: number
    instruction: string
}

export default function StepInstruction({index, instruction}: StepInstructionProps) {
    const {classes} = useStyles()
    return (
        <div className={classes.container}>
            <span className={classes.stepIndexContainer}>
                <span>{index}</span>
            </span>
            <span>{instruction}</span>
        </div>
    )
}

const useStyles = tss
    .create(() => ({
        container: {
            display: 'flex',
            alignItems: 'center',
            marginBottom: fr.spacing('2w'),
        },
        stepIndexContainer: {
            display: 'flex',
            backgroundColor: fr.colors.decisions.background.flat.blueFrance.default,
            color: fr.colors.decisions.background.default.grey.default,
            borderRadius: '50%',
            marginRight: fr.spacing('1w'),
            width: 27,
            height: 27,
            span: {
                margin: 'auto',
            }
        }
    }))