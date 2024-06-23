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
import { REQUIRED_FIELD_ERROR_MESSAGE } from "@/app/shared/data/form/error-messages"
import AlertContext from "@/app/shared/contexts/AlertContext"
import { Collection } from "@/app/caradoc/collections/interfaces/Collection"

// We create a modal instance
export const evaluationModal = createModal({
    id: "eval-modal",
    isOpenedByDefault: false,
})

// This schema will be used to validate the form data
const schema = z
    .object({
        collectionId: z.string({
            errorMap: () => ({message: REQUIRED_FIELD_ERROR_MESSAGE}),
        }).min(1),
        workflow: z.string().min(1)
    })

// We infer the type of the form data
type FormData = z.infer<typeof schema>


export interface EvaluationModalProps {
    data : Collection[]
}

/**
 * This component is a modal form that allows users to evaluate a pipeline on a collection
 * @param workflows
 * @constructor
 */
export default function EvaluationModal({  
                                            data,
                                          }: EvaluationModalProps) {
    const {classes} = useStyles()
    
    // We'll need to display an alert message whether the files upload is successful or not
    const {setAlert} = useContext(AlertContext)

    const [workflows, setWorkflows] = useState([])

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
    const isOpen = useIsModalOpen(evaluationModal)
 
    useEffect(() => {
        if (isOpen) {
            // fetch workflows when we open the modal to fill the select
            fetch('/api/settings/workflows')
            .then(response => response.json())
            .then(workflows => setWorkflows(workflows))
            .catch(error => console.error(error));

        }
    }, [isOpen])

    /*
    This hooks launch the evaluation process according to the form elements 
    @param data 
    */
    const handleEvaluation = async (data : FormData) => {

        evaluationModal.close()

        setAlert({
            description: "Veulliez patienter",
            isOpen: true,
            severity: 'info',
            title: "Lancement évaluation",
            autoHide: true,
        })
        // We implement SSE here because the server can take a long time to process
        const response = await fetch('/api/evaluation/eval', {
            method: 'POST',
            body: JSON.stringify({
                "workflow" : data.workflow,
                "index" :   data.collectionId,
                "precision" : 5
            }),
            headers: {
                'Content-Type': 'application/json',
            },
        }).then(() => setAlert({
            description: "Evaluation réussie",
            isOpen: true,
            severity: 'success',
            title: "Evaluation réussie",
            autoHide: true,
        })).catch(error => console.log(error))
       

    }

    return (
        <evaluationModal.Component title="Evaluation méthode"
                                     concealingBackdrop={!isSubmitting}>
            {/* Collection form */}
            <form onSubmit={handleSubmit(handleEvaluation)}
                  className={classes.container}>

                {/* Collection index name selection */}
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
                {/* Collection index name selection */}
                <div className={classes.section}>
                    {/* Collection select */}
                    <Select
                        label="Workflow"
                        nativeSelectProps={{
                            ...register('workflow'),
                            disabled: isSubmitting,
                            defaultValue: '',
                        }}
                        state={errors?.collectionId && 'error'}
                        stateRelatedMessage={errors?.collectionId?.message}>
                        <option value="" disabled>Workflow</option>
                        {
                            workflows.map(
                                workflow =>
                                    <option key={workflow} value={workflow}>
                                        {workflow}
                                    </option>
                            )}
                    </Select>
                </div>
                <div className={classes.buttonsContainer}>
                    {/* Cancel button */}
                    {/* Upload button and message */}
                    <div className={classes.loadingButtonAndMessageContainer}>

                        {/* Submit button */}
                        <Button type="submit"
                                       iconPosition="right">
                        Lancer l'évaluation 
                        </Button>
                    </div>
                </div>
            </form>
        </evaluationModal.Component>
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