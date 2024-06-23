import { tss } from "tss-react"
import { fr } from "@codegouvfr/react-dsfr"
import { createModal } from "@codegouvfr/react-dsfr/Modal"
import FilesDeletionData from "@/app/caradoc/chat/interfaces/FilesDeletionData"

// We'll display the appropriate warning message when the user tries to clear the attached files
const filesDeletionWarningDescription = {
    resetButton: "La réinitialisation du chat entraînera la suppression des fichiers chargés."
}

// Files deletion modal instance
export const clearFilesModal = createModal({
    id: "clear-files-warning-modal",
    isOpenedByDefault: false
})

interface FilesDeletionModalProps {
    filesDeletionData: FilesDeletionData
    handleConfirmFilesDeletion: () => void
}

/**
 * Files deletion modal component
 * @param filesDeletionData provides information about which component triggered the delete action (reset button)
 * @param handleConfirmFilesDeletion proceeds to files deletion
 * @constructor
 */
export default function FilesDeletionModal({filesDeletionData, handleConfirmFilesDeletion}: FilesDeletionModalProps) {
    const {classes} = useStyles()
    return (
        <clearFilesModal.Component title={<span className={classes.modalTitle}>Suppression des fichiers</span>}
                                   iconId="ri-link-unlink"
                                   buttons={
                                       [
                                           {
                                               children: "Annuler"
                                           },
                                           {
                                               iconId: "ri-link-unlink",
                                               onClick: handleConfirmFilesDeletion,
                                               children: "Supprimer",
                                           }
                                       ]
                                   }>
            <p>Attention !</p>
            <p>{filesDeletionWarningDescription[filesDeletionData.trigger]}</p>
            <p>Êtes-vous sûr de vouloir continuer ?</p>
        </clearFilesModal.Component>
    )
}

const useStyles = tss
    .create(() => ({
        modalTitle: {
            marginLeft: fr.spacing('1w'),
        },
    }))