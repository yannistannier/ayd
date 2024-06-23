import { useContext, useEffect, useMemo } from "react"
import { createModal } from "@codegouvfr/react-dsfr/Modal"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { tss } from "tss-react"
import { fr } from "@codegouvfr/react-dsfr"
import { Input } from "@codegouvfr/react-dsfr/Input"
import { useIsModalOpen } from "@codegouvfr/react-dsfr/Modal/useIsModalOpen"
import type { FrIconClassName, RiIconClassName } from "@codegouvfr/react-dsfr/src/fr/generatedFromCss/classNames"
import AlertContext from "@/app/shared/contexts/AlertContext"
import { REQUIRED_FIELD_ERROR_MESSAGE } from "@/app/shared/data/form/error-messages"
import LoadingButton from "@/app/caradoc/collections/components/LoadingButton"
import { Collection } from "@/app/caradoc/collections/interfaces/Collection"


// Whether we are in 'add' or 'edit' mode, we'll display different metadata on the interface
interface CollectionFormMetadata {
    [key: string]: {
        title: string
        buttonText: string
        iconId: FrIconClassName | RiIconClassName
        successMessageTitle: string
        successMessage: string
        errorMessage: string
        fetchParams: {
            method: string
            getUrl: (id?: string) => string
        }
    }
}

// We define the schema for the collection form
const setSchema = (data: Collection[]) => z
    .object({
        name: z.string({
            errorMap: () => ({message: REQUIRED_FIELD_ERROR_MESSAGE}),
        }).min(1),
    })
    .superRefine(({name}, ctx) => {
        // We'll not allow users to pick a name that already exists
        if (data.map(collection => collection.name).includes(name)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Cette collection existe déjà.',
                path: ['name']
            })
        }
    })

// We create a react-dsfr modal instance
export const collectionFormModal = createModal({
    id: "collection-form-modal",
    isOpenedByDefault: false,
})

// We define the format of data expected by the modal
export interface CollectionFormModalProps {
    id: string
    name: string
    data: Collection[]
    handleOnSuccessOperation: () => void
}

/**
 * This modal component handles creation and edition of collections
 * @param id
 * @param name
 * @param existingCollectionNames
 * @param handleOnSuccessOperation
 * @constructor
 */
export default function CollectionFormModal({
                                                id,
                                                name,
                                                data,
                                                handleOnSuccessOperation
                                            }: CollectionFormModalProps) {
    const {classes} = useStyles()

    // We'll need to display an alert message whether the collection creation was successful or not
    const {setAlert} = useContext(AlertContext)

    // We define our schema which is dynamic based on the existing collection names
    const schema = useMemo(() => setSchema(data), [data])

    // We infer the type of the form data | since the schema is dynamic, it has to be put inside the component
    type FormData = z.infer<typeof schema>

    // Metadata for the collection form
    // As it depends on the schema, we'll define it inside the component
    const collectionFormMetadata: CollectionFormMetadata = useMemo(() => ({
        add: {
            title: 'Ajouter une collection',
            buttonText: 'Ajouter la collection',
            iconId: 'ri-add-line',
            successMessageTitle: 'Collection ajoutée',
            successMessage: "La collection a été créée avec succès.",
            errorMessage: "L'ajout de la collection a échoué.",
            fetchParams: {
                method: 'POST',
                getUrl: () => '/api/collections/',
            },
        },
        edit: {
            title: 'Modifier une collection',
            buttonText: 'Modifier la collection',
            iconId: 'ri-pencil-line',
            successMessageTitle: 'Collection modifiée',
            successMessage: "La collection a été modifiée avec succès.",
            errorMessage: "La modification de la collection a échoué.",
            fetchParams: {
                method: 'PATCH',
                getUrl: (id) => `/api/collections/${id}`,
            },
        },
    }), [schema])

    // We create a form instance with react-hook-form
    const {
        register,
        formState: {errors, isSubmitting},
        handleSubmit,
        reset,
    } = useForm<FormData>({
        resolver: zodResolver(schema),
    })

    const isOpen = useIsModalOpen(collectionFormModal)

    // The modal component provided by react-dsfr is always mounted in the DOM
    // since our modal init data should be different depending on the mode (add or edit),
    // we need to find a way to reset the form data when the modal is opened
    useEffect(() => {
        if (isOpen) {
            // We'll reset the name field with the name of the collection
            // provided by the props when the modal is opened
            reset({
                name,
            })
            // Fixme: add clear errors in case of inconsistencies on reset
        }
    }, [isOpen, name])

    // We can determine the mode depending on the provided id
    const mode = id === 'add' ? 'add' : 'edit'

    /**
     * Handle the form submission
     * @param data
     */
    const handleOnSubmit = async (data: FormData) => {
        try {
            const response = await fetch(
                // Request URL
                collectionFormMetadata[mode].fetchParams.getUrl(id),
                // Request options
                {
                    method: collectionFormMetadata[mode].fetchParams.method,
                    body: JSON.stringify({
                        name: data.name
                    }),
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            )

            // When the operation completes, we close the modal
            collectionFormModal.close()

            // We handle incorrect responses when submitting the form
            if (!response.ok) {
                throw new Error(collectionFormMetadata[mode].errorMessage)
            } else {
                // We give users positive feedback on the operation by displaying an alert message
                setAlert({
                    description: collectionFormMetadata[mode].successMessage,
                    isOpen: true,
                    severity: 'success',
                    title: collectionFormMetadata[mode].successMessageTitle,
                    autoHide: true,
                })

                // We execute the success callback provided by the parent component
                // It simply refreshes the collections list
                handleOnSuccessOperation()
            }
        } catch (e: any) {
            // We show the users an error message if the operation failed
            setAlert({
                description: e.message,
                isOpen: true,
                severity: 'error',
                title: 'Erreur'
            })
        }
    }

    return (
        <collectionFormModal.Component title={collectionFormMetadata[mode].title}
                                       concealingBackdrop={!isSubmitting}>
            {/* Collection form */}
            <form onSubmit={handleSubmit(handleOnSubmit)}
                  className={classes.container}>

                {/* Collection name input */}
                <Input className={classes.input}
                       hintText="Le nom doit être unique dans la base"
                       label="Nom de la collection"
                       state={errors?.name && 'error'}
                       stateRelatedMessage={errors?.name?.message}
                       nativeInputProps={{
                           ...register('name'),
                           placeholder: 'Nom de la collection',
                       }}
                />
                <div>
                    {/* Submit button */}
                    <LoadingButton className={classes.button}
                                   type="submit"
                                   isLoading={isSubmitting}
                                   iconId={collectionFormMetadata[mode].iconId}
                                   disabled={isSubmitting}
                                   iconPosition="right">
                        {collectionFormMetadata[mode].buttonText}
                    </LoadingButton>
                </div>
            </form>
        </collectionFormModal.Component>
    )
}

const useStyles = tss
    .create(() => ({
        container: {
            display: 'flex',
            gap: fr.spacing('4w'),
        },
        input: {
            width: '70%',
            minWidth: 100,
        },
        button: {
            width: 'max-content',
            transform: 'translateY(55px)',
        }
    }))