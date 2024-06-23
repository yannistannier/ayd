"use client"

import { useEffect, useMemo, useState } from "react"
import { tss } from "tss-react"
import { fr } from "@codegouvfr/react-dsfr"
import { createColumnHelper, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import CollectionFile from "@/app/caradoc/collections/interfaces/File"
import { Button } from "@codegouvfr/react-dsfr/Button"
import MainTitle from "@/app/shared/components/headings/MainTitle"
import MainContainer from "@/app/shared/components/containers/MainContainer"
import DateCell from "@/app/caradoc/collections/components/table/DateCell"
import Table from "@/app/caradoc/collections/components/table/Table"
import AddFilesFormModal, {
    addFilesFormModal,
    AddFilesFormModalProps
} from "@/app/caradoc/collections/components/modals/AddFilesFormModal"
import { Collection } from "@/app/caradoc/collections/interfaces/Collection"
import DeleteFileModal, {
    deleteFileModal,
    DeleteFileModalProps
} from "@/app/caradoc/collections/components/modals/DeleteFileModal"
import { toCamelCase } from "@/app/shared/utils/object"

// Let's grab the utility provided by tanstack table to create our columns with type safety
const columnHelper = createColumnHelper<CollectionFile>()

// According to tanstack table, it is good to provide a fallback data
// that live outside the component for optimization,
// so it gets a stable reference
const initialFiles: CollectionFile[] = []

export default function CollectionPage({
                                           params,
                                       }: {
    params: { collectionId: string }
}) {
    const {classes, cx} = useStyles()

    // We'll keep track of the loading state of our data
    const [isLoading, setIsLoading] = useState(true)

    // We define the data model that will populate our table
    const [data, setData] = useState(initialFiles)

    // We define the data model representing our columns
    const columns = useMemo(() => [
        columnHelper.accessor('updatedAt', {
            header: 'MAJ le',
            cell: ({getValue}) => <DateCell date={getValue()}/>
        }),
        columnHelper.accessor('collectionName', {
            header: 'Collection',
            cell: ({getValue}) => <div className={classes.collectionName}>{getValue()}</div>
        }),
        columnHelper.accessor('name', {
            header: 'Fichier',
            cell: ({getValue}) => <div className={classes.filename}>{getValue()}</div>
        }),
        columnHelper.accessor('extension', {
            header: 'Extension',
            cell: ({getValue}) => <div className={classes.extension}>{getValue()}</div>
        }),
        columnHelper.display({
            header: 'Actions',
            cell: ({row}) =>
                // Action buttons
                <div className={classes.actionButtonsContainer}>
                    {/* Download file button */}
                    <Button iconId="ri-download-2-fill"
                            linkProps={{
                                href: `/api/collections/${row.original.collectionId}/files/${row.original.id}`,
                                target: '_blank'
                            }}
                            priority="tertiary no outline"
                            title="Télécharger le fichier"
                    />

                    {/* Delete file button */}
                    <Button className={classes.deleteActionButton}
                            iconId="ri-delete-bin-fill"
                            onClick={handleOpenDeleteFileModal({
                                collectionId: row.original.collectionId,
                                collectionName: row.original.collectionName,
                                fileId: row.original.id,
                                fileName: row.original.name,
                                handleOnSuccessOperation: getFiles
                            })}
                            priority="tertiary no outline"
                            title="Supprimer le fichier"
                    />
                </div>,
        }),
    ], [data])

    const [collectionData, setCollectionData] = useState([{
        id: '',
        name: ''
    }] as Collection[])

    // This represents the data that will be loaded into the files modal
    const [addFilesFormModalData, setAddFilesFormModalData] = useState({
        data: collectionData,
    } as AddFilesFormModalProps)

    const collectionName = useMemo(() => collectionData[0]?.name || '', [collectionData])

    // This represents the data that will be loaded into the delete file modal
    const [deleteFileModalData, setDeleteFileModalData] = useState({} as DeleteFileModalProps)

    // We can now create a table instance that will contain properties and methods to manipulate our data
    const table = useReactTable({
        columns,
        data,
        getCoreRowModel: getCoreRowModel()
    })

    // We fetch our files when the page loads
    useEffect(() => {
        getFiles()
    }, [])

    /**
     * This function fetches and refreshes the files from a collection
     */
    const getFiles = () => {
        setIsLoading(true)
        fetch(`/api/collections/${params.collectionId}`)
            .then(async response => {
                const jsonResponse = await response.json()
                const formattedResponse = toCamelCase(jsonResponse)
                setData(formattedResponse.files.map((file: CollectionFile) => ({
                    ...file,
                    collectionId: formattedResponse.id,
                    collectionName: formattedResponse.name,
                })))
                setCollectionData([
                    {
                        id: formattedResponse.id,
                        name: formattedResponse.name,
                    }
                ] as Collection[])
            })
            .catch(() => {
                // Fixme: handle error
            })
            .finally(() => {
                setIsLoading(false)
            })
    }

    /**
     * Provides data to the files modal and opens it
     * @param addFilesFormModalData
     */
    const handleOpenAddFilesFormModal = (addFilesFormModalData: AddFilesFormModalProps) => () => {
        setAddFilesFormModalData({...addFilesFormModalData})
        addFilesFormModal.open()
    }

    /**
     * Provides data to the delete file modal and opens it
     * @param deleteFileModalData
     */
    const handleOpenDeleteFileModal = (deleteFileModalData: DeleteFileModalProps) => () => {
        setDeleteFileModalData({...deleteFileModalData})
        deleteFileModal.open()
    }
    return (
        <>
            {
                !isLoading &&
                <>
                    {/* Files modal */}
                    <AddFilesFormModal {...addFilesFormModalData}/>

                    {/* Collection delete modal */}
                    <DeleteFileModal {...deleteFileModalData}/>
                </>
            }
            <MainContainer>
                <MainTitle>Fichiers{collectionName && ` | Collection ${collectionName}`}</MainTitle>

                {/* Table management buttons */}
                <div className={classes.buttonsContainer}>
                    <div>
                        {/* Add file to collection button */}
                        <Button className='fr-mr-2w'
                                priority="secondary"
                                iconId="ri-arrow-left-line"
                                iconPosition="right"
                                linkProps={{
                                    href: '/caradoc/collections'
                                }}>
                            Retour aux collections
                        </Button>

                        {/* Refresh files button */}
                        <Button priority="secondary"
                                iconId="ri-loop-right-line"
                                iconPosition="right"
                                onClick={getFiles}>
                            Rafraîchir
                        </Button>
                    </div>

                    {
                        !isLoading &&
                        <>
                            {/* Add file to collection button */}
                            <Button priority="secondary"
                                    iconId="ri-file-add-line"
                                    iconPosition="right"
                                    disabled={isLoading}
                                    onClick={handleOpenAddFilesFormModal({
                                        collectionId: collectionData[0]?.id || '',
                                        data: collectionData,
                                        handleOnSuccessOperation: getFiles
                                    })}>
                                Ajouter un fichier dans {collectionName}
                            </Button>
                        </>
                    }
                </div>

                {/* Collections table */}
                <Table isLoading={isLoading}
                       columns={columns}
                       data={data}
                       table={table}
                       noDataMessage="Aucun fichier dans la collection"
                       muiTableProps={{
                           "aria-label": "Liste des fichiers"
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
        filename: {
            color: fr.colors.decisions.text.label.blueFrance.default,
            ...fr.spacing('padding', {topBottom: '1v', rightLeft: '3v'}),
            borderRadius: 16,
            border: `1px solid ${fr.colors.decisions.text.label.blueFrance.default}`,
            maxWidth: 'max-content',
            fontWeight: 500,
        },
        extension: {
            color: fr.colors.decisions.text.disabled.grey.default,
        },
        actionButtonsContainer: {
            display: 'flex',
            gap: fr.spacing('1w'),
            'a, button:hover': {
                borderRadius: '50%',
            }
        },
        deleteActionButton: {
            color: fr.colors.decisions.border.actionHigh.error.default,
        },
    }))
