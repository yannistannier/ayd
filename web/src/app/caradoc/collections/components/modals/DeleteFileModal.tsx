"use client"

// We create a react-dsfr modal instance
import { createModal } from "@codegouvfr/react-dsfr/Modal"
import { useContext, useState } from "react"
import AlertContext from "@/app/shared/contexts/AlertContext"
import { tss } from "tss-react"
import { fr } from "@codegouvfr/react-dsfr"
import { Button } from "@codegouvfr/react-dsfr/Button"
import LoadingButton from "@/app/caradoc/collections/components/LoadingButton"

// We create a react-dsfr modal instance
export const deleteFileModal = createModal({
    id: "file-delete-modal",
    isOpenedByDefault: false,
})


export interface DeleteFileModalProps {
    collectionId: string
    collectionName: string
    fileId: string
    fileName: string
    handleOnSuccessOperation: () => void
}

/**
 * This modal allows users to delete a specific file from a collection
 * @param collectionId
 * @param collectionName
 * @param fileId
 * @param fileName
 * @param handleOnSuccessOperation
 * @constructor
 */
export default function DeleteFileModal({
                                            collectionId,
                                            collectionName,
                                            fileId,
                                            fileName,
                                            handleOnSuccessOperation,
                                        }: DeleteFileModalProps) {
    const {classes} = useStyles()

    // We'll need to display an alert message whether the file deletion was successful or not
    const {setAlert} = useContext(AlertContext)

    // We'll display a loading spinner when the deletion is in progress
    const [isDeleting, setIsDeleting] = useState(false)

    /**
     * Handles the deletion of the file
     */
    const handleDeleteFile = () => {
        setIsDeleting(true)
        fetch(`/api/collections/${collectionId}/files/${fileId}`,
            {
                method: 'DELETE',
            })
            .then(() => {
                // When the operation completes, we close the modal
                deleteFileModal.close()

                setAlert({
                    description: "Le fichier a été supprimée avec succès",
                    isOpen: true,
                    severity: 'success',
                    title: "Suppression réussie",
                    autoHide: true,
                })

                // We execute the success callback provided by the parent component
                handleOnSuccessOperation()
            })
            .catch((e) => {
                // When the operation fails, we close the modal
                deleteFileModal.close()

                setAlert({
                    description: e.message,
                    isOpen: true,
                    severity: 'error',
                    title: 'Erreur'
                })
            })
            .finally(() => {
                setIsDeleting(false)
            })
    }

    /**
     * Handles the cancellation of the file deletion
     */
    const handleCancelDeleteFile = () => {
        deleteFileModal.close()
    }

    return (
        <deleteFileModal.Component title="Suppression du fichier"
                                   concealingBackdrop={isDeleting}>
            <p>Êtes-vous sûr de vouloir supprimer le fichier <span
                className={classes.emphasize}>{fileName}</span> de la collection <span
                className={classes.emphasize}>{collectionName}</span>?</p>

            <div className={classes.buttonsContainer}>
                <div className={classes.innerButtonsContainer}>
                    <Button priority="secondary"
                            disabled={isDeleting}
                            onClick={handleCancelDeleteFile}>
                        Annuler
                    </Button>
                    <LoadingButton priority="primary"
                                   isLoading={isDeleting}
                                   disabled={isDeleting}
                                   iconId="ri-delete-bin-6-line"
                                   iconPosition="right"
                                   onClick={handleDeleteFile}>
                        Supprimer le fichier
                    </LoadingButton>
                </div>
            </div>
        </deleteFileModal.Component>
    )
}

const useStyles = tss
    .create(() => ({
        buttonsContainer: {
            display: "flex",
        },
        innerButtonsContainer: {
            marginLeft: 'auto',
            display: 'flex',
            gap: fr.spacing('2w'),
        },
        emphasize: {
            fontWeight: 700,
        },
    }))
