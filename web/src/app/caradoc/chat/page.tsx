"use client"

import { ChangeEvent, SyntheticEvent, useEffect, useRef, useState } from "react"
import { Controller, FieldValues, useForm, useWatch } from "react-hook-form"
import { capitalize } from "lodash"
import { keyframes } from '@mui/system'
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { tss } from "tss-react/mui"
import Dropzone, { DropzoneRef } from "react-dropzone"
import { fr } from "@codegouvfr/react-dsfr"
import { Button } from "@codegouvfr/react-dsfr/Button"
import { Select } from "@codegouvfr/react-dsfr/Select"
import Input from "@codegouvfr/react-dsfr/Input"
import { Header } from "@codegouvfr/react-dsfr/Header"
import { Alert, AlertProps } from "@codegouvfr/react-dsfr/Alert"
import ActionButton from "./components/ActionButton"
import Source from "./interfaces/Source"
import SourceComponent from "./components/Source"
import AnswerModeLabel from "./components/AnswerModeLabel"
import { answerModeData } from "./data/answer-mode"
import SourceContainer from "@/app/caradoc/chat/components/SourceContainer"
import SourceMetadata from "@/app/caradoc/chat/components/SourceMetadata"
import AnswerMode from "@/app/caradoc/chat/interfaces/AnswerMode"
import SourceDetailModal, { sourceDetailModal } from "@/app/caradoc/chat/components/modals/SourceDetailModal"
import SourceModalProps from "@/app/caradoc/chat/interfaces/SourceModalProps"
import SourcesDrawer from "@/app/caradoc/chat/components/SourcesDrawer"
import FilesDeletionData from "@/app/caradoc/chat/interfaces/FilesDeletionData"
import FilesDeletionModal, { clearFilesModal } from "@/app/caradoc/chat/components/modals/FilesDeletionModal"
import { createRandomString } from "@/app/caradoc/chat/utils/string"
import { CustomAbortDOMException } from "@/app/caradoc/chat/exceptions/CustomAbortDOMException"
import { RadioButtons } from "@codegouvfr/react-dsfr/RadioButtons"
import FieldErrorMessage from "@/app/caradoc/chat/components/FieldErrorMessage"
import { ACCEPTED_FILE_TYPES } from "@/app/shared/data/form/accepted-file-types"
import { REQUIRED_FIELD_ERROR_MESSAGE } from "@/app/shared/data/form/error-messages"
import { Collection as ChatCollection } from "@/app/caradoc/chat/interfaces/Collection"
import { toSnakeCase } from "@/app/shared/utils/object"

// We'll display our logo on both the header and the center of the chat page
const logoData = {
    alt: "Logo Caradoc",
    src: '/logos/logo-caradoc.png',
}

// Our tokens will be composed by 32 characters in that format '16chars-16chars'
const PARTIAL_TOKEN_SIZE = 16

// We'll define the duration for which the alert messages will be displayed in case of error
const ALERT_MESSAGE_DISPLAY_DURATION = 3500

// We'll limit the number of sources to display
const maxNumberOfSourcesToDisplay = 4

// Enum for user feedback
enum UserFeedback {
    Down = 0,
    Up = 1,
}

// Users can orient the chatbot to provide answers according to specific settings
interface Settings {
    isLoading: boolean
    collections: ChatCollection[]
    workflows: string[]
}

// Keeps track of the loading state when uploading files as well as displaying a different "upload-in-progress" message depending on the elapsed time
interface FilesUploadData {
    areUploading: boolean
    uploadingMessage?: string
}

// This is the format expected by the API when sending a user prompt request
interface UserPromptRequest {
    workflow: string
    mode: AnswerMode
    collectionId?: string
    collectionName?: string
    index: string
    message: string
    token: string
}


interface UserPromptResponse {
    sources?: Source[]
    content: string
    generationCompleted?: boolean
}

interface MessageBlock {
    userPromptRequest: UserPromptRequest
    userPromptResponse: UserPromptResponse
    errorMessage?: {
        content: string
    }
}

// This will be the format of the alert message displayed when an error occurs
interface AlertMessageData {
    message?: string
    severity: AlertProps.Severity
    isOpen: boolean
    description: string
    title: string
}

// 'workflows' and 'message' fields will benefit from this same validation rule
const validateString = z.string({
    errorMap: () => ({message: REQUIRED_FIELD_ERROR_MESSAGE}),
}).min(1)

const modes = ["collection", "file"] as const

// This schema will be used to validate the form data
const schema = z
    .object({
        workflow: validateString,
        mode: z.enum(modes, {
            errorMap: () => ({message: REQUIRED_FIELD_ERROR_MESSAGE}),
        }),
        collectionId: z.string().optional(),
        files: z.array(z.custom<File>()).optional(),
        message: validateString,
    })
    .superRefine(({mode, collectionId, files}, ctx) => {
        if (mode === "collection" && !collectionId) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: REQUIRED_FIELD_ERROR_MESSAGE,
                path: ['collectionId']
            })
        }
        if (mode === "file" && (!files || files.length === 0)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "La sélection de fichiers est requise.",
                path: ['files']
            })
        }
    })

// We can infer the types of the schema in order to re-use them for TS validation
type FormData = z.infer<typeof schema>


/**
 * Prevents the default action of an event
 * We'll use it as a placeholder for buttons that don't have any action yet
 * @param e
 */
const noAction = (e: SyntheticEvent) => {
    e.preventDefault()
}

/**
 * Generates a token to identify and manage file uploads
 * The 1st half of the token never changes, while the 2nd half is randomly updated when needed
 * @param token
 */
const generateToken = (token?: string) => token ?
    // If a token has already been generated, we only update the second half of it
    `${token.split('-')[0]}-${createRandomString(PARTIAL_TOKEN_SIZE)}` :
    // Otherwise, we generate a new token
    `${createRandomString(PARTIAL_TOKEN_SIZE)}-${createRandomString(PARTIAL_TOKEN_SIZE)}`


export default function ChatPage() {
    /* -------------------------------------------------------------------------------------------------------------- */
    /* Hooks and contexts ------------------------------------------------------------------------------------------- */
    /* -------------------------------------------------------------------------------------------------------------- */

    // We'll store a generated token to identify and manage file uploads
    const [token, setToken] = useState('')

    // We'll keep track of the selection collection
    const [selectedCollection, setSelectedCollection] = useState({} as ChatCollection)

    // We'll store our settings data in this state
    const [settings, setSettings] = useState<Settings>({
        isLoading: true,
        collections: [],
        workflows: [],
    })

    // This variable will contain the source data to display when opening the source modal
    const [sourceModalData, setSourceModalData] = useState<SourceModalProps>({} as SourceModalProps)

    // This property controls whether the sources' drawer is open or not
    const [openSourcesDrawer, setOpenSourcesDrawer] = useState(false)

    // When clicking 'See more...', we'll send the entire message which also contains the sources to be displayed by the drawer
    const [drawerMessage, setDrawerMessage] = useState({
        sources: [] as UserPromptResponse['sources'],
        mode: '' as AnswerMode,
    })

    // This represents the messages exchanged between the user and the chat API
    const [messages, setMessages] = useState<MessageBlock[]>([])

    // We'll use this object to provide better loading feedback to the user during files upload
    const [filesUploadData, setFilesUploadData] = useState<FilesUploadData>({} as FilesUploadData)

    // We'll store some metadata related to files deletion that will help us perform the right actions when clearing the attached files depending on the user's interactions
    const [filesDeletionData, setFilesDeletionData] = useState<FilesDeletionData>({} as FilesDeletionData)

    // We'll need a hold of our message input to adjust its height when user types into it
    const inputMessageRef = useRef<HTMLTextAreaElement | null>(null)

    // We'll also need to scroll our messages section to the bottom when a new message is added
    const chatWindowRef = useRef<HTMLElement | null>(null)

    // We'll add a reference to the bottom of the messages section to scroll to it when a new message is posted
    const chatWindowBottomRef = useRef<HTMLDivElement | null>(null)

    // We'll use this controller to cancel the user prompt request
    const [formSubmitController, setFormSubmitController] = useState<AbortController | null>(null)

    // We'll use this controller to cancel the files upload request
    const [filesUploadController, setFilesUploadController] = useState<AbortController | null>(null)

    // This is the content that will show up in case of errors
    const [alertMessageData, setAlertMessageData] = useState({} as AlertMessageData)

    // We'll use react-hook-form to handle our form validation and submission
    const {
        register,
        formState: {errors, isSubmitting},
        handleSubmit,
        reset,
        control,
        setValue,
    } = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: {
            // Fixme: remove default values
            // workflow: 'Classique',
            // collection: 'nausicaa_2023_OpenData',
            // message: "Qu'est-ce que le club des médiateurs internes ?",
        }
    })

    // We'll need to track the state of our uploaded files
    const filesWatch = useWatch({control, name: 'files'})
    const modeWatch = useWatch({control, name: 'mode'})

    // We retrieve our styles
    const {classes, cx} = useStyles({isSubmitting})

    /* -------------------------------------------------------------------------------------------------------------- */
    /* Effects ------------------------------------------------------------------------------------------------------ */
    /* -------------------------------------------------------------------------------------------------------------- */

    // When the page load, we'll generate a random token that will identify the user's uploaded files
    useEffect(() => {
        setToken(generateToken())
    }, [])

    // We fetch our settings data when the component mounts
    useEffect(() => {
        // We prepare requests to retrieve our settings data
        const collectionsRequest = fetch('/api/collections/')
        const workflowsRequest = fetch('/api/settings/workflows')

        // We fetch our settings data in parallel
        Promise.all([collectionsRequest, workflowsRequest])
            .then(
                async ([collectionsResponse, workflowsResponse]) => {
                    const [collections, workflows] = await Promise.all([collectionsResponse.json(), workflowsResponse.json()])
                    setSettings(prevState => ({
                        ...prevState,
                        collections: collections.data.map((collection: ChatCollection) => ({
                            id: collection.id,
                            name: collection.name
                        })),
                        workflows,
                    }))
                })
            .catch(() => {
                // Fixme: handle errors when fetching data
            })
            .finally(() => setSettings(prevState => ({...prevState, isLoading: false})))
    }, [])

    // Every time a new message is added, we scroll the chat section to the bottom
    useEffect(() => {
        if (chatWindowBottomRef.current) {
            chatWindowBottomRef.current.scrollIntoView({behavior: "smooth"})
        }
    }, [messages])

    // The react-dsfr alert does not disappear automatically after a certain time,
    // so we'll implement the automatic dismissal of the alert message ourselves
    useEffect(() => {
        let timeout: NodeJS.Timeout

        // When a new alert message is displayed, we'll set a timeout to dismiss it after a certain duration
        if (alertMessageData.isOpen) {
            timeout = setTimeout(() => {
                handleCloseAlert()
            }, ALERT_MESSAGE_DISPLAY_DURATION)
        }

        // We should not forget to clear any existing timeout when the component unmounts
        return () => {
            timeout && clearTimeout(timeout)
        }
    }, [alertMessageData])


    /* -------------------------------------------------------------------------------------------------------------- */
    /* Handlers ----------------------------------------------------------------------------------------------------- */
    /* -------------------------------------------------------------------------------------------------------------- */

    /**
     * Formats the alert message data before setting it
     * @param alertMessageData
     */
    const formatAndSetAlertMessageData = (alertMessageData: AlertMessageData) => {
        setAlertMessageData({
            ...alertMessageData,
            // Defaults values will be set if not present
            title: alertMessageData.title ?? 'Erreur',
            severity: alertMessageData.severity ?? 'error',
            isOpen: !!alertMessageData.isOpen,
        })
    }

    /**
     * Closes the alert message
     */
    const handleCloseAlert = () => {
        setAlertMessageData({} as AlertMessageData)
    }

    const resetChat = () => {
        // We reset the list of messages
        setMessages([])

        // We reset the form fields back to their default values
        reset()
    }

    /**
     * Takes care of clearing the files after clicking the "New Chat" button
     * This function will be called after confirming files deletion on the warning modal
     */
    const handleResetChatWhileFilesAttached = async () => {
        // We clear the attached files
        clearAttachedFiles()

        resetChat()
    }

    /**
     * Clears the chat session
     * @param attachedFiles
     */
    const handleResetChat = (attachedFiles: FormData['files']) =>
        async () => {
            if (filesUploadData.areUploading) {
                // When files are being uploaded, we cancel the request and renew the token
                filesUploadController?.abort(new CustomAbortDOMException("L'envoi de fichiers a été interrompu.", 'Nouveau chat', 'warning', 'resetButton'))
                setToken(generateToken(token))

                // We reset the chat
                resetChat()
            } else if (isSubmitting) {
                // When the form is being submitted, we cancel the request
                formSubmitController?.abort(new CustomAbortDOMException('La génération de réponse a été interrompue.', 'Nouveau chat', 'warning', 'resetButton'))

                // We reset the chat
                resetChat()
            } else {
                // First, if any files are attached, we clear them
                if (Array.isArray(attachedFiles) && (attachedFiles.length > 0)) {
                    // When a user tries to reset the chat while files are attached, we'll warn him before proceeding
                    setFilesDeletionData({
                        trigger: 'resetButton',
                    })
                    clearFilesModal.open()
                } else {
                    // We reset the chat
                    resetChat()
                }
            }
        }

    /**
     * Handles the files upload with a token to keep track of the client's files
     * @param token
     */
    const handleFilesUpload = (token: string) =>
        async (acceptedFiles: File[]) => {
            // Since we need to handle file uploads, we need to use FormData to send our data
            const formData = new FormData()

            // We prepare the request to send the files
            acceptedFiles.forEach(file => {
                formData.append(`files`, file)
            })

            // We also incorporate the token as part of the data we will send
            formData.append('token', token)

            try {
                // We'll use the AbortController to cancel the submission of files if needed
                const filesUploadAbortController = new AbortController()

                // We keep the controller in memory in case we need to abort the request
                setFilesUploadController(filesUploadAbortController)

                // We start showing the upload indicator to give users immediate feedback
                setFilesUploadData({
                    areUploading: true,
                    uploadingMessage: "Préparation de l'envoi..."    // Warning: this message need to be in sync with the 1st one returned by the API
                })

                // We send the data to the API
                const response = await fetch('/api/chat/upload', {
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
                        const {value, done} = await reader.read();
                        const currentEventStr = decoder.decode(value)
                        if (done) {
                            // When files are successfully dropped, we update the 'files' form value
                            setValue(
                                'files',
                                acceptedFiles,
                                {
                                    shouldValidate: true,
                                }
                            )

                            // We provide users with positive feedback when files are successfully uploaded
                            setAlertMessageData({
                                description: "Les fichiers ont été chargés avec succès.",
                                isOpen: true,
                                severity: 'success',
                                title: 'Chargement réussi',
                            })
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
                // If there is a problem during file upload, we should clear the attached files
                setValue("files", [])

                formatAndSetAlertMessageData({
                    ...e,
                    description: e.message,
                    isOpen: true
                })
            } finally {
                // We hide the files upload indicator
                setFilesUploadData({} as FilesUploadData)
            }
        }

    /**
     * Launches or cancels the files upload
     * @param open
     */
    const handleSelectFilesOrCancelUpload = (open: DropzoneRef['open']) => () => {
        if (filesUploadData.areUploading) {
            // When files are uploading, clicking the buttons means we want to cancel the upload
            filesUploadController?.abort(new CustomAbortDOMException("L'envoi de fichiers a été interrompu.", 'Upload interrompu', 'info', 'filesUploadCancelButton'))
            setToken(generateToken(token))
        } else {
            // When no files are uploading, clicking the buttons means we want to open the file dialog to select files
            open()
        }
    }

    /**
     * Clears the attached files when the user clicks on the clear button
     */
    const clearAttachedFiles = () => {
        // We clear the files form value even before launching the request
        setValue('files', [])

        // We prepare a new token to be used for the next file uploads
        setToken(generateToken(token))

        // We launch the deletion of the files in an optimistic way
        // Since we consider the files cleared, there is no need to display a loading indicator
        // If there is a problem with file deletion, we can simply log the error in the backend
        fetch('/api/chat/upload/clear', {
            method: 'POST',
            body: JSON.stringify({token}),
            headers: {
                'Content-Type': 'application/json',
            },
        })
    }

    /**
     * Clears the attached files when the user clicks on the clear files button
     */
    const handleClearAttachedFiles = () => {
        if (isSubmitting) {
            formSubmitController?.abort(new CustomAbortDOMException('La génération de réponse a été interrompue.', 'Suppression des fichiers', 'warning', 'clearAttachedFilesButton'))
        }
        clearAttachedFiles()
    }

    /**
     * Proceeds to form submission
     * @param data
     */
    const handleSubmitForm = async (data: FieldValues) => {
        // Right after form submission, we reset the message field
        setValue('message', '')

        // We resize the message input to its original size
        if (inputMessageRef.current) {
            inputMessageRef.current.style.height = 'auto'
        }

        // We prepare our message containing request and response to insert into the feed
        const messageBlock: MessageBlock = {
            userPromptRequest: {
                ...data,
                token,
                index: data.mode === 'collection' ? data.collectionId : token,
                collectionName: data.mode === 'collection' ? selectedCollection.name : '',
                collectionId: data.mode === 'collection' ? selectedCollection.id : '',
            } as UserPromptRequest,
            userPromptResponse: {} as UserPromptResponse
        }
        // We update the list of messages with the new user one
        const updatedMessages: MessageBlock[] = [
            ...messages,
            messageBlock
        ]

        // We update our state with the user message, so it gets immediately displayed on the chat interface
        setMessages(updatedMessages)

        try {
            // We'll use the AbortController to cancel the submission of the form if needed
            const formSubmitAbortController = new AbortController()

            // We keep the controller in memory in case we need to abort the request
            setFormSubmitController(formSubmitAbortController)

            // We can now send the complete user prompt request to our API
            const response = await fetch('/api/chat/message', {
                method: 'POST',
                body: JSON.stringify(toSnakeCase(messageBlock.userPromptRequest)),
                signal: formSubmitAbortController.signal,
                headers: {
                    'Accept': 'text/event-stream',
                    'Content-Type': 'application/json',
                },
            })

            if (response.body) {
                const reader = response.body.getReader()
                const decoder = new TextDecoder("utf-8")

                // As long as there is data returned by the stream, we process the incoming messages
                while (true) {
                    const {value, done} = await reader.read();
                    const currentEventStr = decoder.decode(value)
                    if (done) {
                        setMessages(messages => ([
                            // We grab all the messages except the last one
                            ...messages.slice(0, -1),
                            {
                                // We'll modify the last message by saying generation has been completed
                                ...messages[messages.length - 1],
                                userPromptResponse: {
                                    ...messages[messages.length - 1].userPromptResponse,
                                    generationCompleted: true
                                }
                            }
                        ]))
                        break;
                    }

                    // Since we receive JSON data, we need to parse it to exploit it
                    try {
                        // It seems events sometime arrives together as being buffered
                        const currentEvents = currentEventStr
                            .split("$$$\n")
                            .filter(eventStr => eventStr)
                        for (let currentEventStr of currentEvents) {
                            const currentEvent = JSON.parse(currentEventStr)
                            if (currentEvent.event === "sources") {
                                setMessages(messages => {
                                    // We need to target the last message
                                    const lastMessage: MessageBlock = {
                                        ...messages[messages.length - 1],
                                        userPromptResponse: {
                                            content: '',
                                            // We extract the sources from the "preData" event
                                            // Fixme: eventually, we'll need to create a generic function that camelcases all properties of an object or array of objects
                                            // Fixme: that function should also handle null values returned from the API
                                            sources: currentEvent.data.sources.map((source: any) => {
                                                const finalSource = {
                                                    ...source
                                                }
                                                if (source.file?.page_number) {
                                                    finalSource.file.pageNumber = source.file.page_number
                                                    delete finalSource.file.page_number
                                                }
                                                return finalSource
                                            })
                                        }
                                    }

                                    return [
                                        ...messages.slice(0, -1),
                                        lastMessage
                                    ]
                                })
                            } else if (currentEvent.event === "content") {
                                setMessages(messages => {
                                    // We need to target the last message
                                    const lastMessage: MessageBlock = {
                                        ...messages[messages.length - 1],
                                        userPromptResponse: {
                                            ...messages[messages.length - 1].userPromptResponse,
                                            // We just need to concatenate the content received with what was previously accumulated
                                            content: messages[messages.length - 1].userPromptResponse.content + currentEvent.data.content,
                                        }
                                    }

                                    return [
                                        ...messages.slice(0, -1),
                                        lastMessage
                                    ]
                                })
                            }
                        }
                    } catch (e) {
                        throw new Error("La traitement de la réponse a échoué.")
                    }
                }
            } else {
                throw new Error("La génération de réponse a échoué.")
            }
        } catch (e: any) {
            // When any problem occurs, we display an alert message
            formatAndSetAlertMessageData({
                ...e,
                description: e.message,
                isOpen: true,
            })

            // After that, we can display an error message in the message feed except when the reset button is clicked
            // in which case enriching the messages' feed does not make sense since we'll clear it
            if (e.trigger === 'resetButton') {
                return
            }

            setMessages(messages => ([
                // We grab all the messages except the last one
                ...messages.slice(0, -1),
                {
                    // We'll modify the last message by saying generation has been completed
                    ...messages[messages.length - 1],
                    userPromptResponse: {
                        ...messages[messages.length - 1].userPromptResponse,
                        generationCompleted: true,
                    },
                    errorMessage: {
                        content: `${e.title ?? 'Erreur'}: ${e.message}`,
                    }
                }
            ]))
        }
    }

    /**
     * Get feedback from user for an AI response
     * @param feedback
     * @param message
     */
    const handleFeedback = (feedback: UserFeedback, message: MessageBlock) => {
        fetch('/api/chat/feedback', {
            method: 'POST',
            body: JSON.stringify(toSnakeCase({
                userPromptRequest: message.userPromptRequest,
                userPromptResponse: message.userPromptResponse,
                userFeedback: feedback
            })),
            headers: {
                'Content-Type': 'application/json',
            },
        })
    }
    /**
     * Aborts the submission of the form
     * @param e
     */
    const handleCancelSubmission = (e: SyntheticEvent) => {
        e.preventDefault()
        formSubmitController?.abort(new CustomAbortDOMException('La génération de réponse a été interrompue.', 'Arrêt', 'info', 'formSubmitCancelButton'))

        // Fixme: maybe send negative feedback to API when the request is aborted
    }

    const handleOnSubmit = (e: SyntheticEvent) => {
        return isSubmitting ?
            handleCancelSubmission(e) :
            filesUploadData.areUploading ?
                // When files are uploading, we'll not disable the submit button but rather do nothing instead
                noAction(e) :
                handleSubmit(handleSubmitForm)(e)
    }

    /**
     * Loads data into the source modal and opens it
     * @param source
     * @param indexPosition
     * @param answerMode
     */
    const handleOpenSourceModal = (
        source: Source,
        indexPosition: number,
        answerMode: AnswerMode
    ) => () => {
        setSourceModalData({
            source,
            indexPosition,
            answerMode
        })
        sourceDetailModal.open()
    }

    /**
     * Opens the sources' drawer and populates the sources
     * @param message
     */
    const handleOpenSourcesDrawer = (message: MessageBlock) => () => {
        setDrawerMessage({
            sources: message.userPromptResponse.sources,
            mode: message.userPromptRequest.mode,
        })
        setOpenSourcesDrawer(true)
    }

    /**
     * Closes the sources' drawer
     */
    const handleCloseSourcesDrawer = () => {
        setOpenSourcesDrawer(false)
    }

    return (
        <>
            {/* Files deletion modal */}
            <FilesDeletionModal filesDeletionData={filesDeletionData}
                                handleConfirmFilesDeletion={handleResetChatWhileFilesAttached}/>

            {/* Source detail modal */}
            <SourceDetailModal {...sourceModalData}/>

            {/* Sources drawer */}
            <SourcesDrawer
                open={openSourcesDrawer}
                handleOpenSourceDetailModal={handleOpenSourceModal}
                handleClose={handleCloseSourcesDrawer}
                sources={drawerMessage.sources!}
                answerMode={drawerMessage.mode}/>
            


            {/* Alert snack message */}
            <div className={classes.alert}>
                <Alert severity={alertMessageData.severity}
                       title={alertMessageData.title}
                       description={alertMessageData.description}
                       closable
                       small
                       isClosed={!alertMessageData.isOpen}
                       onClose={handleCloseAlert}/>
            </div>

            {/* Form content */}
            <form className={classes.mainContainer}
                  onSubmit={handleOnSubmit}>

                {/* Sidebar */}
                <aside className={classes.sidebar}>

                    {/* Header content + Reset chat button */}
                    <div className={classes.headerContainer}>

                        <Header className={classes.header}
                                brandTop=""
                                homeLinkProps={{
                                    href: '/',
                                    title: 'BNP Paribas - Caradoc',
                                }}
                                operatorLogo=""
                                serviceTagline=""
                                serviceTitle="IT Group"
                        />

                        {/* Reset + Collection management buttons */}
                        <div className={classes.headerButtons}>
                            {/* Reset chat button */}
                            <Button priority="primary"
                                    title="Réinitialisation du chat"
                                    iconPosition="left"
                                    iconId="ri-refresh-line"
                                    size="small"
                                    type="button"
                                    onClick={handleResetChat(filesWatch)}>
                                Nouveau chat
                            </Button>

                            {/* Collection management button */}
                            <Button priority="secondary"
                                    title="Gestion des collections"
                                    iconId="ri-database-2-line"
                                    size="small"
                                    linkProps={{
                                        href: "/caradoc/collections",
                                        target: '_blank'
                                    }}>
                                Gestion des collections
                            </Button>
                        </div>
                    </div>

                    {/* Chat configuration */}
                    <div className={classes.configurationContainer}>
                        {/* Settings */}
                        <div className={classes.configurationSection}>

                            {/* Settings title */}
                            <div className={classes.configurationTitle}>
                                <i className="ri-settings-3-line"></i>
                                Paramètres
                            </div>

                            {/* Workflow selection */}
                            <Select
                                label="Workflow"
                                nativeSelectProps={{
                                    ...register('workflow'),
                                    defaultValue: '',
                                }}
                                state={errors?.workflow && 'error'}
                                stateRelatedMessage={errors?.workflow?.message}
                            >
                                <option value="" disabled>Workflow</option>
                                {settings.workflows.map(
                                    workflow =>
                                        <option key={workflow} value={workflow}>{workflow}</option>,
                                )}
                            </Select>

                            {/* Mode selection */}
                            <Controller
                                control={control}
                                name="mode"
                                render={({field}) => (
                                    <RadioButtons
                                        legend="Mode"
                                        options={
                                            modes.map(mode => ({
                                                label: <AnswerModeLabel mode={mode}/>,
                                                nativeInputProps: {
                                                    checked: field.value === mode,
                                                    onChange: () => field.onChange(mode)
                                                }
                                            }))
                                        }
                                        state={errors?.mode && 'error'}
                                        stateRelatedMessage={errors?.mode?.message}
                                    />
                                )}/>

                            {/* Collection selection */}
                            {
                                modeWatch === "collection" &&
                                <Controller
                                    control={control}
                                    name="collectionId"
                                    render={({field}) => (
                                        <Select label="Collection"
                                                nativeSelectProps={{
                                                    ...field,
                                                    defaultValue: '',
                                                    onChange: e => {
                                                        // We update the selected collection
                                                        setSelectedCollection({
                                                            id: e.target.value || '',
                                                            name: settings.collections.find(collection => collection.id === e.target.value)?.name || ''
                                                        })
                                                        field.onChange(e)
                                                    }
                                                }}
                                                state={errors?.collectionId && 'error'}
                                                stateRelatedMessage={errors?.collectionId?.message}
                                        >
                                            <option value="" disabled>Collection</option>
                                            {
                                                settings.collections.map(
                                                    collection =>
                                                        <option key={collection.id}
                                                                value={collection.id}>{collection.name}</option>,
                                                )
                                            }
                                        </Select>
                                    )}/>
                            }
                        </div>

                        {/* Attached files */}
                        {
                            modeWatch === "file" &&
                            <div className={classes.configurationSection}>
                                <div className={cx(classes.configurationTitle, 'fr-text-xs')}>
                                    <i className="ri-attachment-2"/>
                                    <span>Fichiers associés</span>
                                    <div className={classes.clearAttachedFilesButtonContainer}>
                                        {
                                            (filesWatch && filesWatch?.length > 0) &&
                                            <Button
                                                className={classes.clearAttachedFilesButton}
                                                iconId="ri-link-unlink"
                                                onClick={handleClearAttachedFiles}
                                                disabled={filesUploadData.areUploading}
                                                size="small"
                                                title="Suppression fichiers associés"
                                            />
                                        }
                                    </div>
                                </div>
                                <div className={classes.filenamesContainer}>
                                    {
                                        Array.isArray(filesWatch) && filesWatch?.length > 0 ?
                                            <>
                                                {
                                                    filesWatch.map((file, index) => (
                                                        <div key={index} className={cx('fr-text-sm', classes.filename)}>
                                                            {file.name}
                                                        </div>
                                                    ))
                                                }
                                            </> :
                                            <p className='fr-text--xs fr-mb-2w'>
                                                {
                                                    filesUploadData.areUploading ?
                                                        filesUploadData.uploadingMessage :
                                                        'Aucun fichier associé'
                                                }
                                            </p>
                                    }
                                    {
                                        errors?.files?.message &&
                                        // <p className={cx('fr-text--xs', classes.filesAttachedErrorMessage)}>
                                        //     {errors.files.message}
                                        // </p>
                                        <FieldErrorMessage>{errors.files.message}</FieldErrorMessage>
                                    }
                                </div>
                            </div>
                        }
                    </div>
                </aside>

                {/* Chat window */}
                <section className={classes.chatWindow} ref={chatWindowRef}>

                    {/* Messages section */}
                    <div className={classes.messagesSection}>
                        {
                            messages.length === 0 ?
                                // Empty chat window
                                <div className={classes.emptyChatWindowContainer}>
                                    <div>
                                        {/* Logo */}
                                        <div className={classes.messageLogoContainer}>
                                            <img src={logoData.src} alt={logoData.alt}/>
                                        </div>

                                        {/* Chat instructions */}
                                        <div className={classes.chatInstructions}>
                                            <p>2 modes s'offrent à vous pour discuter :</p>
                                            <ul className={classes.modesDescriptionContainer}>
                                                {
                                                    Object.keys(answerModeData).map(
                                                        mode => <li key={mode}>
                                                            <div>
                                                            <span className={classes.answerModeDescription}>
                                                                {answerModeData[mode as AnswerMode].description}
                                                            </span>
                                                                <AnswerModeLabel
                                                                    mode={mode as AnswerMode}/>
                                                            </div>
                                                        </li>
                                                    )
                                                }
                                            </ul>
                                        </div>
                                    </div>
                                </div> :

                                // Chat window with messages
                                <div className={classes.messagesContent}>
                                    {/* Messages contents */}
                                    {
                                        messages.map(
                                            (message, index) =>
                                                <div className={classes.messageContainer}
                                                     key={index}>
                                                    {
                                                        message.userPromptRequest &&
                                                        // User prompt request message content
                                                        <div className={classes.userPromptRequestContainer}>

                                                            {/* Message content */}
                                                            <h4>{message.userPromptRequest.message}</h4>

                                                            {/* Metadata related to the user prompt request */}
                                                            <div className={classes.userPromptRequestMetadata}>
                                                                {['mode', 'workflow', 'collectionName'].map(parameter =>
                                                                    <div key={parameter}>
                                                                        {
                                                                            message.userPromptRequest[parameter as keyof UserPromptRequest] ?
                                                                                <div
                                                                                    className={classes.promptParameterData}>
                                                                                        <span
                                                                                            className={classes.promptParameterLabel}>{parameter === 'collectionName' ? 'collection' : parameter}:</span>
                                                                                    <span
                                                                                        className={classes.promptParameterValue}>{
                                                                                        parameter === 'mode' ?
                                                                                            answerModeData[message.userPromptRequest.mode].name :
                                                                                            message.userPromptRequest[parameter as keyof UserPromptRequest]
                                                                                    }</span>
                                                                                </div> :
                                                                                null}
                                                                    </div>)
                                                                }
                                                            </div>
                                                        </div>

                                                        // Assistant response message
                                                    }

                                                    {/* We get a successful response */}
                                                    {
                                                        message.userPromptResponse !== undefined && <>
                                                            {
                                                                (message.userPromptResponse.sources && message.userPromptResponse.sources.length > 0) &&
                                                                <>
                                                                    {/* Message source title */}
                                                                    <h6 className={classes.messageTitle}>
                                                                        <i className="ri-file-paper-2-line"/>
                                                                        <span>Sources</span>
                                                                    </h6>

                                                                    {/* Message source data */}
                                                                    <div
                                                                        className={cx(classes.answerSectionContainer, classes.sourcesContainer)}>
                                                                        {/* The 1st [maxNumberOfSourcesToDisplay - 1] sources should be displayed */}
                                                                        {
                                                                            message.userPromptResponse.sources.slice(0, maxNumberOfSourcesToDisplay - 1).map(
                                                                                (source, index) => <div
                                                                                    key={source.id}>
                                                                                    <SourceComponent
                                                                                        source={source}
                                                                                        indexPosition={index + 1}
                                                                                        answerMode={message.userPromptRequest.mode}
                                                                                        handleClick={handleOpenSourceModal(source, index + 1, message.userPromptRequest.mode)}/>
                                                                                </div>
                                                                            )
                                                                        }

                                                                        {/* When we have exactly 'maxNumberOfSourcesToDisplay' sources, we can display all of those */}
                                                                        {
                                                                            message.userPromptResponse.sources.length === maxNumberOfSourcesToDisplay &&
                                                                            <div
                                                                                key={message.userPromptResponse.sources[maxNumberOfSourcesToDisplay - 1].id}>
                                                                                <SourceComponent
                                                                                    indexPosition={maxNumberOfSourcesToDisplay}
                                                                                    source={message.userPromptResponse.sources[maxNumberOfSourcesToDisplay - 1]}
                                                                                    answerMode={message.userPromptRequest.mode}
                                                                                    handleClick={handleOpenSourceModal(message.userPromptResponse.sources[maxNumberOfSourcesToDisplay - 1], maxNumberOfSourcesToDisplay, message.userPromptRequest.mode)}/>
                                                                            </div>
                                                                        }

                                                                        {/* When more than 'maxNumberOfSourcesToDisplay' sources, we display a show more button */}
                                                                        {
                                                                            (message.userPromptResponse.sources.length > maxNumberOfSourcesToDisplay) &&
                                                                            <div
                                                                                className={classes.seeMoreSourcesContainer}>
                                                                                <SourceContainer
                                                                                    answerMode={message.userPromptRequest.mode}
                                                                                    handleClick={handleOpenSourcesDrawer(message)}>
                                                                                    {
                                                                                        message.userPromptResponse.sources
                                                                                            .slice(maxNumberOfSourcesToDisplay - 1, maxNumberOfSourcesToDisplay + 1)
                                                                                            .map(
                                                                                                (source, index) =>
                                                                                                    <SourceMetadata
                                                                                                        key={source.id}
                                                                                                        indexPosition={maxNumberOfSourcesToDisplay + index}
                                                                                                        filename={source.file.name}
                                                                                                        answerMode={message.userPromptRequest.mode}
                                                                                                        showIcon={false}/>
                                                                                            )
                                                                                    }
                                                                                    <div
                                                                                        className={classes.moreCharacters}>...
                                                                                    </div>
                                                                                    <div
                                                                                        className={classes.seeMoreSourcesMessage}>
                                                                                        Voir plus...
                                                                                    </div>
                                                                                </SourceContainer>
                                                                            </div>
                                                                        }
                                                                    </div>
                                                                </>
                                                            }

                                                            {
                                                                message.userPromptResponse.content && <>
                                                                    {/* Message response */}
                                                                    <h6 className={classes.messageTitle}>
                                                                        <i className="ri-question-answer-line"/>
                                                                        <span>Réponse</span>
                                                                    </h6>

                                                                    {/* Message text content */}
                                                                    <div className={classes.answerSectionContainer}>
                                                                        {message.userPromptResponse.content}
                                                                    </div>
                                                                </>
                                                            }

                                                            {/* We get an error response */}
                                                            {
                                                                message.errorMessage &&
                                                                <div
                                                                    className={classes.errorMessageContainer}>
                                                                    <i className="ri-error-warning-line"/>
                                                                    {capitalize(message.errorMessage.content)}
                                                                </div>
                                                            }

                                                            {
                                                                message.userPromptResponse.generationCompleted && <>
                                                                    {/* Answer feedback */}
                                                                    <div
                                                                        className={classes.answerFeedbackContainer}>
                                                                        <div>
                                                                            <div
                                                                                className="positiveFeedbackIcon">
                                                                                <Button
                                                                                    iconId="ri-thumb-up-line"
                                                                                    onClick={() => {
                                                                                        handleFeedback(UserFeedback.Up, message)
                                                                                    }}
                                                                                    type="button"
                                                                                    priority="tertiary no outline"
                                                                                    title="Feedback positif"
                                                                                />
                                                                            </div>
                                                                            <div className="negativeFeedbackIcon">
                                                                                <Button
                                                                                    iconId="ri-thumb-down-line"
                                                                                    onClick={() => {
                                                                                        handleFeedback(UserFeedback.Down, message)
                                                                                    }}
                                                                                    type="button"
                                                                                    priority="tertiary no outline"
                                                                                    title="Feedback négatif"
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </>
                                                            }
                                                        </>
                                                    }

                                                    {/* Separation line between messages */}
                                                    {
                                                        messages.length - 1 !== index &&
                                                        <hr className={classes.answerSectionSeparation}/>
                                                    }

                                                </div>
                                        )
                                    }

                                    {/* Bottom div to handle scroll to bottom when a new message is added */}
                                    <div ref={chatWindowBottomRef}/>
                                </div>
                        }
                    </div>

                    {/* Input section */}
                    <div className={classes.inputSection}>
                        {/* Warning message */}
                        <div className={classes.llmAccuracyWarning}>
                            Des erreurs sont possibles. Nous vous invitons à controller la validité des réponses.
                        </div>
                        {/* Message input */}
                        <div className={classes.inputContainer}>
                            {/* Message input */}
                            <Controller
                                control={control}
                                name="files"
                                render={({field}) => (
                                    <Dropzone noClick
                                              accept={ACCEPTED_FILE_TYPES}
                                              disabled={isSubmitting}
                                              onDrop={handleFilesUpload(token)}>
                                        {({getRootProps, getInputProps, isDragActive, open}) => (
                                            <section>
                                                <div {...getRootProps()}>
                                                    <input {...getInputProps({
                                                        onChange: field.onChange,
                                                    })} />
                                                    <Controller
                                                        control={control}
                                                        name="message"
                                                        render={({
                                                                     field: {
                                                                         onChange: builtInOnChange,
                                                                         onBlur,
                                                                         value,
                                                                         ref
                                                                     }
                                                                 }) => (
                                                            <>
                                                                <div>
                                                                    <Input
                                                                        label={null}
                                                                        disabled={isSubmitting}
                                                                        textArea
                                                                        className={cx(classes.input, isDragActive ? classes.textAreaBorderRadius : undefined)}
                                                                        // state={errors?.message && 'error'}
                                                                        // stateRelatedMessage={errors?.message?.message}
                                                                        nativeTextAreaProps={{
                                                                            placeholder: modeWatch ? answerModeData[modeWatch].placeholder : 'Sélectionnez un mode pour discuter',
                                                                            rows: 1,
                                                                            onBlur,
                                                                            value,
                                                                            ref: (e: HTMLTextAreaElement) => {
                                                                                ref(e)
                                                                                // We can share the ref provided by react-hook-form and initialize our own ref
                                                                                inputMessageRef.current = e
                                                                            },
                                                                            onChange: e => {
                                                                                builtInOnChange(e)
                                                                                if (inputMessageRef.current) {
                                                                                    inputMessageRef.current.style.height = 'auto'
                                                                                    inputMessageRef.current.style.height = `${e.target.scrollHeight}px`
                                                                                }
                                                                            },
                                                                            onKeyPress: e => {
                                                                                // We'll submit the form when pressing 'Enter' without the 'Shift' key
                                                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                                                    handleOnSubmit(e)
                                                                                }
                                                                            }
                                                                        }}
                                                                    />
                                                                </div>

                                                                {
                                                                    isDragActive &&
                                                                    <div className={classes.dropZoneContainer}>
                                                                            <span
                                                                                className="fr-text-sm">Déposez ici</span>
                                                                        <i className="ri-drag-drop-line"/>
                                                                    </div>
                                                                }
                                                            </>
                                                        )}
                                                    />

                                                    {/* Files upload indicator */}
                                                    {
                                                        filesUploadData.areUploading &&
                                                        <div className={classes.filesAttachedLoadingMessage}>
                                                            {filesUploadData.uploadingMessage}
                                                        </div>
                                                    }

                                                    {/* File upload button */}
                                                    <div
                                                        className={cx(classes.inputButtonContainer, classes.fileUploadButtonContainer)}>

                                                        {/* Files upload loading spinner */}
                                                        <ActionButton isLoading={filesUploadData.areUploading}
                                                                      sx={{
                                                                          color: filesWatch && filesWatch?.length > 0 ?
                                                                              fr.colors.decisions.background.default.grey.default :
                                                                              fr.colors.decisions.background.active.redMarianne.hover,
                                                                      }}
                                                        />

                                                        {/* File upload icon button */}
                                                        <Button
                                                            iconId={filesUploadData.areUploading ? "ri-stop-fill" : "ri-attachment-2"}
                                                            priority="secondary"
                                                            type="button"
                                                            className={cx(classes.inputIcon, classes.fileUploadIcon, filesWatch && filesWatch?.length > 0 ? classes.fileUploadIconActive : classes.fileUploadIconInactive)}
                                                            title={filesUploadData.areUploading ? "Arrêt du téléversement" : "Téléversement de fichiers"}
                                                            disabled={isSubmitting || (modeWatch === 'collection') || !modeWatch}
                                                            onClick={handleSelectFilesOrCancelUpload(open)}/>
                                                    </div>

                                                </div>
                                            </section>
                                        )}
                                    </Dropzone>
                                )}
                            />

                            {/* Send message button */}
                            <div className={cx(classes.inputButtonContainer, classes.sendMessageButtonContainer)}>

                                {/* Send message loading spinner */}
                                <ActionButton isLoading={isSubmitting}
                                              sx={{
                                                  color: fr.colors.decisions.background.default.grey.default,
                                              }}
                                />

                                {/* Send message icon button */}
                                <Button iconId={isSubmitting ? "ri-stop-fill" : "fr-icon-send-plane-fill"}
                                        className={cx(classes.inputIcon, classes.sendMessageIcon)}
                                        title={isSubmitting ? "Arrêt de l'envoi du message" : "Envoi du message"}
                                        type="submit"/>
                            </div>
                        </div>
                    </div>
                </section>
            </form>
        </>
    )
}

const chatWindowMaxWidth = '49rem'
const configurationTitleHeight = 43
const inputMessageMaxHeight = 550
const sideBarWidth = 300
const customBoxShadow = `0px 0px 7px -4px ${fr.colors.decisions.border.plain.blueFrance.default}`

const filesAttachedLoadingAnimation = keyframes`
    0% {
        opacity: 1;
    }
    25% {
        opacity: .7;
    }
    50% {
        opacity: .3;
    }
    75% {
        opacity: .7;
    }
    100% {
        opacity: 1;
    }
`

const useStyles = tss
    .withParams<{ isSubmitting: boolean }>()
    .withNestedSelectors<"seeMoreSourcesMessage">()
    .create(({theme, classes, isSubmitting}) => ({
        alert: {
            position: 'absolute',
            right: fr.spacing('4w'),
            top: fr.spacing('3w'),
            zIndex: 1,
            background: fr.colors.decisions.background.default.grey.default,
        },
        mainContainer: {
            height: '100vh',
            display: 'flex',
            '&> *': {
                height: '100%',
            },
        },
        sidebar: {
            position: 'relative',
            minWidth: sideBarWidth,
            width: sideBarWidth,
            borderRight: `1px solid ${fr.colors.decisions.border.default.grey.default}`,
            overflowY: 'auto',
            boxShadow: customBoxShadow,
            ...fr.spacing('padding', {bottom: '4w', rightLeft: '3w'}),
        },
        headerContainer: {
            position: 'sticky',
            top: 0,
            left: 0,
            right: 0,
            paddingBottom: fr.spacing('3w'),
            marginLeft: `-${fr.spacing('3w')}`,
            marginRight: `-${fr.spacing('3w')}`,
            zIndex: 1,
            backgroundColor: fr.colors.decisions.background.default.grey.default,
            '@-moz-document url-prefix()': {
                transform: `translateX(-${fr.spacing('3w')})`,
            }
        },
        header: {
            // We'll override the react-dsfr Header component styles given the specific design of the chat interface
            [theme.breakpoints.up("lg")]: {
                marginBottom: fr.spacing('2w'),
                'div.fr-header__logo': {
                    paddingRight: 0
                },
                'div.fr-header__operator': {
                    padding: 0,
                    transform: 'translateX(6px) scale(1.7)',
                },
                'div.fr-header__service': {
                    paddingRight: 0,
                    transform: 'translateX(10px) scale(.8)',
                },
                '--idle': "unset",
                '--hover': "unset",
                '--active': "active",
                filter: "unset",
            },
        },
        headerButtons: {
            paddingLeft: fr.spacing('3w'),
            paddingRight: fr.spacing('3w'),
            '> *': {
                marginTop: fr.spacing('2w'),
            }
        },
        configurationContainer: {
            marginTop: fr.spacing('2w'),
        },
        configurationSection: {
            marginBottom: fr.spacing('4w'),
        },
        configurationTitle: {
            display: 'flex',
            alignItems: 'center',
            maxHeight: configurationTitleHeight,
            ...fr.spacing('padding', {topBottom: '1w', rightLeft: '3w'}),
            marginBottom: fr.spacing('2w'),
            marginLeft: `-${fr.spacing('3w')}`,
            marginRight: `-${fr.spacing('3w')}`,
            fontWeight: 700,
            i: {
                marginRight: fr.spacing('1w'),
            },
        },
        clearAttachedFilesButtonContainer: {
            position: "relative",
        },
        clearAttachedFilesButton: {
            transform: 'scale(.9)',
            borderRadius: '50%',
            marginLeft: fr.spacing('1w'),
            backgroundColor: fr.colors.decisions.background.actionHigh.redMarianne.active,
            '&:hover, &:active': {
                backgroundColor: `${fr.colors.decisions.background.actionLow.redMarianne.active} !important`,
            },
        },
        filenamesContainer: {
            ...fr.spacing('margin', {rightLeft: '1w'}),
        },
        filesAttachedErrorMessage: {
            color: fr.colors.decisions.text.default.error.default,
        },
        filename: {
            marginBottom: fr.spacing('1w'),
            maxWidth: 235,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
        },
        chatWindow: {
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
        },
        emptyChatWindowContainer: {
            display: "flex",
            width: '100%',
            transform: 'translateY(-5%)',
            '> div': {
                margin: 'auto',
            }
        },
        messageLogoContainer: {
            display: 'flex',
            marginBottom: fr.spacing('4w'),
            img: {
                margin: "auto",
                width: 120,
            },
        },
        chatInstructions: {
            ...fr.spacing('padding', {topBottom: '3w', rightLeft: '4w'}),
            color: fr.colors.decisions.text.mention.grey.default,
            boxShadow: customBoxShadow,
            borderRadius: 8,
            p: {
                textAlign: 'center',
            },
        },
        modesDescriptionContainer: {
            li: {
                marginBottom: fr.spacing('1w'),
                '> div': {
                    display: 'flex',
                    alignItems: 'center',
                }
            }
        },
        answerModeDescription: {
            minWidth: 440,
        },
        messagesSection: {
            height: '100%',
            width: '100%',
            overflowY: 'auto',
            display: 'flex',
        },
        messagesContent: {
            maxWidth: chatWindowMaxWidth,
            marginLeft: 'auto',
            marginRight: 'auto',
            width: '100%',
            ...fr.spacing('padding', {top: '6w', rightLeft: '3w'}),
        },
        messageContainer: {
            width: '100%',
            marginBottom: fr.spacing('2w'),
        },
        messageTitle: {
            display: 'flex',
            alignItems: 'center',
            color: fr.colors.decisions.text.default.grey.default,
            fontSize: '1.2rem',
            i: {
                marginRight: fr.spacing('1w'),
                '::before': {
                    width: 20,
                    height: 20,
                }
            }
        },
        userPromptRequestContainer: {
            marginBottom: fr.spacing('4w'),
            h4: {
                marginBottom: fr.spacing('3v'),
            }
        },
        userPromptRequestMetadata: {
            fontSize: 12,
            '> div': {
                display: 'inline-block',
            }
        },
        promptParameterData: {
            display: 'inline-block',
            marginRight: fr.spacing('2w'),
        },
        promptParameterLabel: {
            marginRight: fr.spacing('1v'),
            color: fr.colors.decisions.text.disabled.grey.default,
        },
        promptParameterValue: {
            fontStyle: 'italic',
            fontWeight: 500
        },
        answerSectionContainer: {
            marginBottom: fr.spacing('4w'),
        },
        errorMessageContainer: {
            display: 'flex',
            alignItems: 'center',
            marginBottom: fr.spacing('2w'),
            i: {
                marginRight: fr.spacing('1w'),
                color: fr.colors.decisions.text.actionHigh.redMarianne.default
            }
        },
        sourcesContainer: {
            display: 'grid',
            gridTemplateColumns: `repeat(${maxNumberOfSourcesToDisplay}, minmax(0, 1fr))`,
            gap: fr.spacing('3w'),
            width: '100%',
        },
        seeMoreSourcesContainer: {
            "&:hover": {
                [`&:hover .${classes.seeMoreSourcesMessage}`]: {
                    fontWeight: 500,
                }
            }
        },
        moreCharacters: {
            display: 'block',
            textAlign: 'center',
        },
        seeMoreSourcesMessage: {
            marginLeft: fr.spacing('5w'),
            transform: `translateY(${fr.spacing('2w')})`,
            fontSize: '.85rem',
        },
        answerFeedbackContainer: {
            display: "flex",
            div: {
                marginLeft: 'auto',
                display: 'flex',
                '.positiveFeedbackIcon button': {
                    display: 'inline-block',
                    color: `${fr.colors.decisions.border.plain.blueFrance.default} !important`,
                },
                '.negativeFeedbackIcon button': {
                    display: 'inline-block',
                    color: `${fr.colors.decisions.border.plain.redMarianne.default} !important`,
                },
                button: {
                    borderRadius: '50%',
                    marginLeft: fr.spacing('1w'),
                },
            }
        },
        answerSectionSeparation: {
            marginTop: fr.spacing('3w'),
        },
        inputSection: {
            display: 'flex',
            width: '100%',
            position: 'relative',
            ...fr.spacing('padding', {top: '1w', rightLeft: '3w', bottom: '6w'}),
        },
        llmAccuracyWarning: {
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'max-content',
            bottom: fr.spacing('1w'),
            fontSize: 12,
            color: fr.colors.decisions.text.disabled.grey.default,
        },
        inputContainer: {
            width: '100%',
            maxWidth: chatWindowMaxWidth,
            marginLeft: 'auto',
            marginRight: 'auto',
            position: 'relative',
        },
        input: {
            textarea: {
                maxHeight: inputMessageMaxHeight,
                overflowY: 'auto',
                resize: 'none',
                paddingRight: fr.spacing("8w"),
                paddingLeft: fr.spacing("8w"),
                paddingTop: fr.spacing("4v"),
            },
        },
        textAreaBorderRadius: {
            textarea: {
                borderRadius: 8,
            }
        },
        dropZoneContainer: {
            borderRadius: 8,
            position: 'absolute',
            backgroundColor: fr.colors.decisions.background.contrast.redMarianne.default,
            color: fr.colors.decisions.background.active.redMarianne.hover,
            border: `1px dashed ${fr.colors.decisions.border.active.redMarianne.default}`,
            marginTop: 8,
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 500,
            fontStyle: 'italic',
            i: {
                marginLeft: fr.spacing('1w'),
            }
        },
        inputButtonContainer: {
            position: 'absolute',
            bottom: 10,
        },
        filesAttachedLoadingMessage: {
            position: 'absolute',
            top: -24,
            fontWeight: 700,
            fontSize: 14,
            color: fr.colors.decisions.background.active.redMarianne.hover,
            animation: `${filesAttachedLoadingAnimation} 1.5s infinite linear`
        },
        fileUploadButtonContainer: {
            left: 16,
        },
        sendMessageButtonContainer: {
            right: 16,
        },
        inputIcon: {
            borderRadius: '50%',
            display: 'flex',
        },
        fileUploadIcon: {
            boxShadow: `inset 0 0 0 1px ${fr.colors.decisions.background.active.redMarianne.hover}`,
            '&:hover:not(:disabled)': {
                color: fr.colors.decisions.background.active.redMarianne.hover,
            }
        },
        fileUploadIconInactive: {
            boxShadow: `inset 0 0 0 1px ${fr.colors.decisions.background.active.redMarianne.hover}`,
            backgroundColor: fr.colors.decisions.background.default.grey.default,
            color: fr.colors.decisions.background.active.redMarianne.hover,
        },
        fileUploadIconActive: {
            color: fr.colors.decisions.background.default.grey.default,
            backgroundColor: fr.colors.decisions.background.active.redMarianne.hover,
        },
        sendMessageIcon: {
            '::before': {
                margin: 'auto',
                transform: isSubmitting ? undefined : 'translate(-1px, 2px)',
            },
            ':disabled': {
                backgroundColor: fr.colors.decisions.background.actionHigh.blueFrance.default,
            },
        },
    }))