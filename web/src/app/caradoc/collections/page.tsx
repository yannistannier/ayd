"use client"

import { useEffect, useMemo, useState } from "react"
import { createColumnHelper, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { tss } from "tss-react"
import { fr } from "@codegouvfr/react-dsfr"
import { Button } from "@codegouvfr/react-dsfr/Button"
import { Tag } from "@codegouvfr/react-dsfr/Tag"
import DateCell from "@/app/caradoc/collections/components/table/DateCell"
import MainTitle from "@/app/shared/components/headings/MainTitle"
import MainContainer from "@/app/shared/components/containers/MainContainer"
import CollectionFormModal, {
    collectionFormModal,
    CollectionFormModalProps
} from "@/app/caradoc/collections/components/modals/CollectionFormModal"
import Table from "@/app/caradoc/collections/components/table/Table"
import AddFilesFormModal, {
    addFilesFormModal,
    AddFilesFormModalProps
} from "@/app/caradoc/collections/components/modals/AddFilesFormModal"
import { Collection } from "@/app/caradoc/collections/interfaces/Collection"
import DeleteCollectionModal, {
    deleteCollectionModal,
    DeleteCollectionModalProps
} from "@/app/caradoc/collections/components/modals/DeleteCollectionModal"
import EvaluationModal, { evaluationModal, EvaluationModalProps } from "@/app/caradoc/collections/components/modals/EvaluationModal"
import { toCamelCase } from "@/app/shared/utils/object"

// Let's grab the utility provided by tanstack table to create our columns with type safety
const columnHelper = createColumnHelper<Collection>()

// According to tanstack table, it is good to provide a fallback data
// that lives outside the component for optimization,
// so it gets a stable reference
const initialCollections: Collection[] = []

export default function CollectionsPage() {
    const {classes} = useStyles()

    // We'll keep track of the loading state of our data
    const [isLoading, setIsLoading] = useState(true)

    // We define the data model that will populate our table
    const [data, setData] = useState(initialCollections)

    // We define the data model representing our columns
    const columns = useMemo(() => [
        columnHelper.accessor('updatedAt', {
            header: 'MAJ le',
            cell: ({getValue}) => <DateCell date={getValue()}/>
        }),
        columnHelper.accessor('createdAt', {
            header: 'Créé le',
            cell: ({getValue}) => <DateCell date={getValue()}/>
        }),
        columnHelper.accessor('name', {
            header: 'Nom',
            cell: ({getValue}) => <div className={classes.collectionName}>{getValue()}</div>
        }),
        columnHelper.accessor('nbFiles', {
            header: 'Nb fichiers',
            cell: ({getValue}) => <Tag small className={classes.nbFiles}>{getValue()}</Tag>
        }),
        columnHelper.display({
            header: 'Actions',
            cell: ({row}) =>
                // Action buttons
                <div className={classes.actionButtonsContainer}>
                    {/* See collection data button */}
                    <Button iconId="ri-eye-fill"
                            linkProps={{
                                href: `/caradoc/collections/${row.original.id}`
                            }}
                            priority="tertiary no outline"
                            title="Voir la collection"
                    />

                    {/* Edit collection button */}
                    <Button iconId="ri-pencil-fill"
                            onClick={handleOpenCollectionFormModal({
                                id: row.original.id,
                                name: row.original.name,
                                data,
                                handleOnSuccessOperation: getCollections
                            })}
                            priority="tertiary no outline"
                            title="Modifier la collection"
                    />

                    {/* Add file to collection button */}
                    <Button iconId="ri-file-add-fill"
                            onClick={handleOpenAddFilesFormModal({
                                collectionId: row.original.id,
                                data,
                                handleOnSuccessOperation: getCollections
                            })}
                            priority="tertiary no outline"
                            title="Ajouter un fichier"
                    />

                    {/* Delete collection button */}
                    <Button className={classes.deleteActionButton}
                            iconId="ri-delete-bin-fill"
                            onClick={handleOpenDeleteCollectionModal({
                                collectionId: row.original.id,
                                collectionName: row.original.name,
                                handleOnSuccessOperation: getCollections
                            })}
                            priority="tertiary no outline"
                            title="Supprimer la collection"
                    />
                </div>,
        }),
    ], [data])

    // This represents the data that will be loaded into the collection modal
    const [collectionFormModalData, setCollectionFormModalData] = useState({} as CollectionFormModalProps)

    // This represents the data that will be loaded into the files modal
    const [addFilesFormModalData, setAddFilesFormModalData] = useState({
        data,
    } as AddFilesFormModalProps)

    // This represents the data that will be loaded into the delete collection modal
    const [deleteCollectionModalData, setDeleteCollectionModalData] = useState({} as DeleteCollectionModalProps)

    // This represents the data that will be loaded into the evaluation modal 

    const [evaluationModalData, setEvaluationModalData] = useState({
        data,
    } as EvaluationModalProps)
    // We can now create a table instance that will contain properties and methods to manipulate our data
    const table = useReactTable({
        columns,
        data,
        getCoreRowModel: getCoreRowModel()
    })
    const mlflowURI = process.env.NEXT_PUBLIC_MLFLOW_URI

    // We fetch our collections when the page loads
    useEffect(() => {
        getCollections()

    }, [])

    /**
     * This function fetches and refreshes the collection
     */
    const getCollections = () => {
        setIsLoading(true)
        fetch('/api/collections/')
            .then(async response => {
                const jsonResponse = await response.json()
                setData(toCamelCase(jsonResponse.data))
            })
            .catch(() => {
                // Fixme: handle error
            })
            .finally(() => {
                setIsLoading(false)
            })
    }
    /**
     * Provides data to the collection modal and opens it
     * @param collectionFormModalData
     */
    const handleOpenCollectionFormModal = (collectionFormModalData: CollectionFormModalProps) => () => {
        setCollectionFormModalData({...collectionFormModalData})
        collectionFormModal.open()
    }

    /**
     * Provides data to the files modal and opens it
     * @param addFilesFormModalData
     */
    const handleOpenAddFilesFormModal = (addFilesFormModalData: AddFilesFormModalProps) => () => {
        setAddFilesFormModalData({...addFilesFormModalData})
        addFilesFormModal.open()
    }

    const handleOpenEvaluationModal = (evaluationModalData : EvaluationModalProps) => () => {
        setEvaluationModalData({...evaluationModalData})
        evaluationModal.open()
    }

    /**
     * Provides data to the delete collection modal and opens it
     * @param deleteCollectionModalData
     */
    const handleOpenDeleteCollectionModal = (deleteCollectionModalData: DeleteCollectionModalProps) => () => {
        setDeleteCollectionModalData({...deleteCollectionModalData})
        deleteCollectionModal.open()
    }
    // This allows to redirect on MlflowUI

    return (
        <>
            {
                !isLoading &&
                <>
                    {/* Collection form modal */}
                    <CollectionFormModal {...collectionFormModalData}/>

                    {/* Files upload form modal */}
                    <AddFilesFormModal {...addFilesFormModalData}/>

                    {/* Collection delete modal */}
                    <DeleteCollectionModal {...deleteCollectionModalData}/>

                    {/* Evaluation modal */}
                    <EvaluationModal {...evaluationModalData} />
                </>
            }

            <MainContainer>
                {/* Main title */}
                <MainTitle>Collections</MainTitle>

                {/* Table management buttons */}
                <div className={classes.buttonsContainer}>
                    <div>
                        {/* Add file to collection button */}
                        <Button className='fr-mr-2w'
                                priority="secondary"
                                iconId="ri-file-add-line"
                                iconPosition="right"
                                disabled={isLoading || (data.length === 0)}
                                onClick={handleOpenAddFilesFormModal({
                                    collectionId: '',
                                    data,
                                    handleOnSuccessOperation: getCollections
                                })}>
                            Ajouter un fichier
                        </Button>

                        {/* Refresh collections button */}
                        <Button priority="secondary"
                                iconId="ri-loop-right-line"
                                iconPosition="right"
                                onClick={getCollections}>
                            Rafraîchir
                        </Button>
                    </div>
                    <div>
                        <Button      

                                disabled={isLoading} 
                        onClick={handleOpenEvaluationModal({
                                data
                        })}> 
                        Evaluation

                        </Button>
                        <Button 
                        priority="secondary"
                        onClick={() => window.open(mlflowURI)}
                        >
                            Accès aux résultats
                        </Button>
                    </div>

                    {/* Add collection button */}
                    <Button iconId="ri-add-line"
                            iconPosition="right"
                            disabled={isLoading}
                            onClick={handleOpenCollectionFormModal({
                                id: 'add',
                                name: '',
                                data,
                                handleOnSuccessOperation: getCollections
                            })}>
                        Ajouter une collection
                    </Button>
                   
                </div>

                {/* Collections table */}
                <Table isLoading={isLoading}
                       columns={columns}
                       data={data}
                       table={table}
                       noDataMessage="Aucune collection"
                       muiTableProps={{
                           "aria-label": "Liste des collections"
                       }}/>
            </MainContainer>
        </>
    )
}

const useStyles = tss
    .create(() => ({
        buttonsContainer: {
            display: "flex",
            justifyContent: "space-between",
            marginBottom: fr.spacing('2w'),
        },
        collectionName: {
            color: fr.colors.decisions.text.inverted.grey.default,
            backgroundColor: fr.colors.decisions.text.label.blueFrance.default,
            ...fr.spacing('padding', {topBottom: '1v', rightLeft: '3v'}),
            borderRadius: 16,
            maxWidth: 'max-content',
            fontWeight: 500,
        },
        nbFiles: {
            fontWeight: 500,
        },
        actionButtonsContainer: {
            display: 'flex',
            gap: fr.spacing('1w'),
            'button:hover': {
                borderRadius: '50%',
            }
        },
        deleteActionButton: {
            color: fr.colors.decisions.border.actionHigh.error.default,
        },  
    }))
