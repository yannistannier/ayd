import { createModal } from "@codegouvfr/react-dsfr/Modal"
import Source from "@/app/caradoc/chat/interfaces/Source"
import { isNumber } from "lodash"
import { tss } from "tss-react"
import { fr } from "@codegouvfr/react-dsfr"
import AnswerMode from "@/app/caradoc/chat/interfaces/AnswerMode"
import SourceModalProps from "@/app/caradoc/chat/interfaces/SourceModalProps";

// These metadata will be used to dynamically construct the modal content
const fileData: {
    label: string
    key: keyof Source['file'],
    condition?: (source: Source) => boolean
}[] = [
    {
        label: "Nom",
        key: "name",
    },
    {
        label: "Type",
        key: "type",
    },
    {
        label: "N° Page",
        key: "pageNumber",
        condition: (source: Source) => isNumber(source.file.pageNumber)
    },
    {
        label: "URL",
        key: "path",
        condition: (source: Source) => !!source.file.path
    }    
]

// We create a modal instance that will provide use properties and methods to interact with the modal
export const sourceDetailModal = createModal({
    id: 'source-modal',
    isOpenedByDefault: false
})

/**
 * Source detail modal component
 * @param source data to display
 * @param indexPosition position of the source to display
 * @param answerMode one of the possible answer modes
 * @constructor
 */
export default function SourceDetailModal({source, indexPosition, answerMode}: SourceModalProps) {
    const {classes} = useStyles({mode: answerMode})
    return (
        <sourceDetailModal.Component
            title={<span className={classes.modalTitle}>Source n°{indexPosition}</span>}
            iconId="ri-file-paper-2-line">
            {
                source ?
                    <>
                        <div className={classes.modalSection}>
                            <h6 className={classes.modalLabelTitle}>Fichier</h6>

                            {/* Add similarity score to modal*/}
                            <div className={classes.modalField}>
                                <span className={classes.modalFileLabel}>Similarité</span>
                                <span>{source.score}</span>
                            </div>

                            {
                                fileData
                                    .filter(field => !field.condition || field.condition(source))
                                    .map(
                                        (field, index) => <div key={index} className={classes.modalField}>
                                            <span className={classes.modalFileLabel}>{field.label}</span>
                                            <span>{source.file[field.key]}</span>
                                        </div>
                                    )
                                
                            }
                        </div>
                        <div className={classes.modalSection}>
                            <h6 className={classes.modalLabelTitle}>Contenu</h6>
                            <p>{source.content}</p>
                        </div>
                    </> : null
            }
        </sourceDetailModal.Component>
    )
}

const useStyles = tss
    .withParams<{ mode: AnswerMode }>()
    .create(({mode}) => ({
        modalTitle: {
            marginLeft: fr.spacing('1w'),
        },
        modalSection: {
            paddingLeft: fr.spacing('2w'),
            marginBottom: fr.spacing('3w'),
            marginTop: fr.spacing('3w'),
            borderLeft: `4px solid`,
            borderColor: mode === "collection" ?
                fr.colors.decisions.border.open.blueFrance.default :
                fr.colors.decisions.border.open.redMarianne.default,
        },
        modalField: {
            marginBottom: fr.spacing('1v'),
        },
        modalLabelTitle: {
            marginBottom: fr.spacing('2w'),
            fontSize: '1rem',
        },
        modalFileLabel: {
            display: 'inline-block',
            color: fr.colors.decisions.text.disabled.grey.default,
            minWidth: 70,
            fontSize: '.75rem',
            fontWeight: 500
        }
    }))