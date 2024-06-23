"use client"

// We create a react-dsfr modal instance
import { useContext, useState } from "react"
import { createModal } from "@codegouvfr/react-dsfr/Modal"
import { tss } from "tss-react"
import { fr } from "@codegouvfr/react-dsfr"
import { Button } from "@codegouvfr/react-dsfr/Button"
import AlertContext from "@/app/shared/contexts/AlertContext"
import LoadingButton from "@/app/caradoc/collections/components/LoadingButton"

// We create a react-dsfr modal instance
export const deleteCollectionModal = createModal({
    id: "collection-delete-modal",
    isOpenedByDefault: false,
})


export interface DeleteCollectionModalProps {
    collectionId: string
    collectionName: string
    handleOnSuccessOperation: () => void
}

/**
 * This modal allows users to delete a specific collection
 * @param collectionId
 * @param collectionName
 * @param handleOnSuccessOperation
 * @constructor
 */
export default function DeleteCollectionModal({
                                                  collectionId,
                                                  collectionName,
                                                  handleOnSuccessOperation,
                                              }: DeleteCollectionModalProps) {
    const {classes} = useStyles()

    // We'll need to display an alert message whether the collection deletion was successful or not
    const {setAlert} = useContext(AlertContext)

    // We'll need to display a loading spinner when the deletion is in progress
    const [isDeleting, setIsDeleting] = useState(false)

    /**
     * Handles the deletion of the collection
     */
    const handleDeleteCollection = () => {
        setIsDeleting(true)
        fetch(`/api/collections/${collectionId}`,
            {
                method: 'DELETE',
            })
            .then(() => {
                // When the operation completes, we close the modal
                deleteCollectionModal.close()

                setAlert({
                    description: "La collection a été supprimée avec succès",
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
                deleteCollectionModal.close()

                // We inform the user of the error
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
     * Handles the cancellation of the collection deletion
     */
    const handleCancelDeleteCollection = () => {
        deleteCollectionModal.close()
    }

    return (
        <deleteCollectionModal.Component title="Suppression de la collection"
                                         concealingBackdrop={isDeleting}>
            <p>Êtes-vous sûr de vouloir supprimer la collection <span
                className={classes.collectionName}>{collectionName}</span> ?</p>
            <p>Tous les fichiers associés à cette collection seront également supprimés !</p>

            <div className={classes.buttonsContainer}>
                <div className={classes.innerButtonsContainer}>
                    <Button priority="secondary"
                            disabled={isDeleting}
                            onClick={handleCancelDeleteCollection}>
                        Annuler
                    </Button>
                    <LoadingButton priority="primary"
                                   isLoading={isDeleting}
                                   disabled={isDeleting}
                                   iconId="ri-delete-bin-6-line"
                                   iconPosition="right"
                                   onClick={handleDeleteCollection}>
                        Supprimer la collection
                    </LoadingButton>
                </div>
            </div>
        </deleteCollectionModal.Component>
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
        collectionName: {
            fontWeight: 700,
        }
    }))
