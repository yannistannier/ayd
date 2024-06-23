"use client"

import { useContext, useEffect, useRef, useState } from "react"
import { tss } from "tss-react"
import { fr } from "@codegouvfr/react-dsfr"
import { z } from "zod"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { createModal } from "@codegouvfr/react-dsfr/Modal"
import { Select } from "@codegouvfr/react-dsfr/Select"
import { Upload } from "@codegouvfr/react-dsfr/Upload"
import { Button } from "@codegouvfr/react-dsfr/Button"
import { useIsModalOpen } from "@codegouvfr/react-dsfr/Modal/useIsModalOpen"
import { ACCEPTED_FILE_TYPES } from "@/app/shared/data/form/accepted-file-types"
import { REQUIRED_FIELD_ERROR_MESSAGE } from "@/app/shared/data/form/error-messages"
import AlertContext from "@/app/shared/contexts/AlertContext"
import LoadingButton from "@/app/caradoc/collections/components/LoadingButton"
import StepInstruction from "@/app/caradoc/collections/components/modals/StepInstruction"
import { Collection } from "@/app/caradoc/collections/interfaces/Collection"
import { Checkbox } from "@codegouvfr/react-dsfr/Checkbox";

// We create a modal instance
export const addFilesFormModal = createModal({
    id: "add-files-form-modal",
    isOpenedByDefault: false,
})

// This schema will be used to validate the form data
const schema = z
    .object({
        collectionId: z.string({
            errorMap: () => ({message: REQUIRED_FIELD_ERROR_MESSAGE}),
        }).min(1),
        files: z.array(z.custom<File>()).nonempty({
            message: "Veuillez ajouter au moins un fichier.",
        }),
        preprocessed: z.boolean().optional()
    })

// We infer the type of the form data
type FormData = z.infer<typeof schema>

// Keeps track of the loading state when uploading files as well as displaying a different "upload-in-progress" message depending on the elapsed time
interface FilesUploadData {
    areUploading: boolean
    uploadingMessage?: string
}

export interface AddFilesFormModalProps {
    collectionId: string
    data: Collection[]
    handleOnSuccessOperation: () => void
}

/**
 * This component is a modal form that allows users to add files to a collection
 * @param collectionId
 * @param data
 * @param handleOnSuccessOperation
 * @constructor
 */
export default function AddFilesFormModal({
                                              collectionId,
                                              data,
                                              handleOnSuccessOperation,
                                          }: AddFilesFormModalProps) {
    const {classes} = useStyles()

    // We'll need to display an alert message whether the files upload is successful or not
    const {setAlert} = useContext(AlertContext)

    // We'll use this controller to cancel the files upload request
    const [filesUploadController, setFilesUploadController] = useState<AbortController | null>(null)

    // We'll use this object to provide better loading feedback to the user during files upload
    const [filesUploadData, setFilesUploadData] = useState<FilesUploadData>({} as FilesUploadData)

    // We'll use that ref to target the input of the Upload react-dsfr component to clear it manually
    const fileUploadInputRef = useRef<HTMLInputElement>(null)

    // We create a form instance with react-hook-form
    const {
        register,
        formState: {errors, isSubmitting},
        handleSubmit,
        control,
        reset,
    } = useForm<FormData>({
        resolver: zodResolver(schema),
    })

    // We'll kept track of the modal open state to reset the form when it's opened
    const isOpen = useIsModalOpen(
        addFilesFormModal,
        {
            // We added a callback to the modal to handle the case when it's closed using the upper Close button
            onConceal: () => {
                // We'll abort the files upload request if it's still in progress when the modal is closed
                isSubmitting && filesUploadController?.abort("L'envoi des fichiers a été interrompu.")
            },
        }
    )

    useEffect(() => {
        if (isOpen) {
            // We'll reset the different fields of the form with the values
            // provided by the props when the modal is opened
            reset({
                collectionId,
                files: [] as File[],
            })

            // We manually clear the react-dsfr input of the Upload component
            if (fileUploadInputRef.current) {
                fileUploadInputRef.current.value = ''
            }

            // We reset the files upload feedback data
            setFilesUploadData({} as FilesUploadData)
        }
    }, [isOpen, collectionId])

    /**
     * Handle the form submission
     * @param data
     */
    const handleOnSubmit = async (data: FormData) => {
        // Since we need to handle file uploads, we need to use FormData to send our data
        const formData = new FormData()

        // We prepare the request to send the files
        data.files.forEach(file => {
            formData.append(`files`, file)
        })
        formData.append(`preprocessed`, data.preprocessed)
        try {
            // We'll use the AbortController to cancel the submission of files if needed
            const filesUploadAbortController = new AbortController()

            // We keep the controller in memory in case we need to abort the request
            setFilesUploadController(filesUploadAbortController)

            // We start showing the upload indicator to give users immediate feedback
            setFilesUploadData({
                areUploading: true,
                uploadingMessage: "Préparation de l'envoi..."
            })

            // We send the data to the API
            const response = await fetch(`/api/collections/${data.collectionId}/files/upload`, {
                method: 'POST',
                body: formData,
                signal: filesUploadAbortController.signal,
                headers: {
                    'Accept': 'text/event-stream',
                },
            })

            if (response.body) {
                const reader = response.body.getReader()
                const decoder = new TextDecoder("utf-8")

                // As long as there is data returned by the stream, we process the incoming messages
                while (true) {
                    const {value, done} = await reader.read()
                    const currentEventStr = decoder.decode(value)
                    if (done) {
                        // When the operation completes, we close the modal
                        addFilesFormModal.close()

                        // We give users positive feedback on the operation by displaying an alert message
                        setAlert({
                            description: "Les fichiers ont été ajoutés avec succès.",
                            isOpen: true,
                            severity: 'success',
                            title: "Ajout réussi",
                            autoHide: true,
                        })

                        // We execute the success callback provided by the parent component
                        handleOnSuccessOperation()

                        break;
                    }

                    // Since we receive JSON data, we need to parse it to exploit it
                    try {
                        // It seems events sometime arrives together as being buffered
                        const currentEvents = currentEventStr
                            .split("\n")
                            .filter(eventStr => eventStr)
                        for (let currentEventStr of currentEvents) {
                            const currentEvent = JSON.parse(currentEventStr)
                            setFilesUploadData({
                                areUploading: true,
                                uploadingMessage: currentEvent.data.message
                            })
                        }
                    } catch (e) {
                        throw new Error("La traitement de la réponse a échoué.")
                    }
                }
            } else {
                throw new Error("La génération de réponse a échoué.")
            }
        } catch (e: any) {
            // When the operation completes even unsuccessfully, we close the modal
            addFilesFormModal.close()

            // We show the users an error message if the operation failed
            setAlert({
                description: e.message,
                isOpen: true,
                severity: 'error',
                title: 'Erreur'
            })
        } finally {
            // We hide the files upload indicator
            setFilesUploadData({} as FilesUploadData)
        }
    }

    /**
     * Handle the files upload cancellation
     */
    const handleAbortFilesUpload = () => {
        addFilesFormModal.close()
    }

    return (
        <addFilesFormModal.Component title="Ajout de fichiers"
                                     concealingBackdrop={!isSubmitting}>
            {/* Collection form */}
            <form onSubmit={handleSubmit(handleOnSubmit)}
                  className={classes.container}>

                {/* Collection index name selection */}
                <StepInstruction index={1} instruction="Sélectionnez une collection de destination"/>
                <div className={classes.section}>
                    {/* Collection select */}
                    <Select
                        label="Collection"
                        nativeSelectProps={{
                            ...register('collectionId'),
                            disabled: isSubmitting,
                            defaultValue: '',
                        }}
                        state={errors?.collectionId && 'error'}
                        stateRelatedMessage={errors?.collectionId?.message}>
                        <option value="" disabled>Collection</option>
                        {
                            data.map(
                                collection =>
                                    <option key={collection.id} value={collection.id}>
                                        {collection.name}
                                    </option>
                            )}
                    </Select>
                </div>

                {/* Files upload */}
                <StepInstruction index={2} instruction="Sélectionnez les fichiers à ajouter"/>
                <div className={classes.section}>
                    <Controller
                        control={control}
                        name="files"
                        render={({field}) => (
                            <Upload multiple
                                    hint={`Format: ${Object.values(ACCEPTED_FILE_TYPES).join(', ')} | 30Mo au total`}
                                    state={errors?.files && 'error'}
                                    stateRelatedMessage={errors?.files?.message}
                                    nativeInputProps={{
                                        accept: Object.keys(ACCEPTED_FILE_TYPES).join(','),
                                        name: field.name,
                                        disabled: isSubmitting,
                                        // We'll reference our manually created input ref for easier clearing
                                        ref: fileUploadInputRef,
                                        onChange: (e) => {
                                            if (e.target.files) {
                                                field.onChange(Array.from(e.target.files))
                                            }
                                        },
                                        onBlur: field.onBlur,
                                    }}
                            />
                        )}/>
                        
                        <Checkbox
                            options={[
                                {
                                hintText : "Uniqument pour les fichiers CSV",
                                label: 'Fichier prétraité ',
                                nativeInputProps: {
                                    ...register("preprocessed")
                                }
                                }
                            ]}
                            small                        
                        />
                </div>
               

                <div className={classes.buttonsContainer}>
                    {/* Cancel button */}
                    <Button priority="secondary"
                            title="Annuler"
                            type="button"
                            onClick={handleAbortFilesUpload}>
                        Annuler
                    </Button>

                    {/* Upload button and message */}
                    <div className={classes.loadingButtonAndMessageContainer}>
                        {/* Uploading message feedback */}
                        {
                            filesUploadData.uploadingMessage &&
                            <div className={classes.uploadingMessage}>{filesUploadData.uploadingMessage}</div>
                        }

                        {/* Submit button */}
                        <LoadingButton type="submit"
                                       isLoading={isSubmitting}
                                       iconId="ri-file-add-line"
                                       disabled={isSubmitting}
                                       iconPosition="right">
                            Envoyer dans la collection
                        </LoadingButton>
                    </div>
                </div>
            </form>
        </addFilesFormModal.Component>
    )
}

const useStyles = tss
    .create(() => ({
        container: {
            marginTop: fr.spacing('4w'),
        },
        section: {
            ...fr.spacing('margin', {bottom: '6w', left: '4w'}),
        },
        buttonsContainer: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
        },
        loadingButtonAndMessageContainer: {
            display: 'flex',
            flexDirection: 'column',
        },
        uploadingMessage: {
            marginBottom: fr.spacing('1w'),
            fontWeight: 500,
            fontSize: 14,
            color: fr.colors.decisions.text.label.redMarianne.default,
        }
    }))