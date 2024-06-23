"use client"

import { tss } from "tss-react"
import { fr } from "@codegouvfr/react-dsfr"
import { ColumnDef, flexRender, Table as ReactTable } from "@tanstack/react-table"
import {
    Table as MuiTable,
    TableProps as MuiTableProps,
    TableCell,
    TableRow,
    TableBody,
    CircularProgress,
    TableHead,
    TableContainer,
} from "@mui/material"

interface TableProps<TData> {
    muiTableProps: MuiTableProps
    isLoading: boolean
    columns: ColumnDef<TData, any>[]
    data: TData[]
    table: ReactTable<TData>,
    noDataMessage?: string
    isLoadingMessage?: string
}

/**
 * This component creates a table based on MUI and tanstack/react-table
 * @param muiTableProps the props expected by MUI Table
 * @param isLoading
 * @param columns the columns expected by react table
 * @param data the data expected by react table
 * @param table the react table instance
 * @param isLoadingMessage
 * @param noDataMessage
 * @constructor
 */
export default function Table<TData>(
    {
        muiTableProps,
        isLoading,
        columns,
        data,
        table,
        isLoadingMessage = "Chargement en cours...",
        noDataMessage = "Aucune donnée",
    }: TableProps<TData>
) {
    const {classes} = useStyles()

    return (
        <TableContainer className={classes.tableContainer}>
            <MuiTable {...muiTableProps}>
                <TableHead className={classes.tableHead}>
                    {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                            {headerGroup.headers.map((header) => (
                                <TableCell key={header.id}>
                                    {header.isPlaceholder
                                        ? null
                                        : flexRender(
                                            header.column.columnDef.header,
                                            header.getContext()
                                        )}
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableHead>
                <TableBody>
                    {
                        // Data is loading
                        isLoading ? (
                                <TableRow hover>
                                    <TableCell
                                        colSpan={columns.length}
                                        className={classes.isLoadingMessage}>
                                        <span>{isLoadingMessage}</span>
                                        <CircularProgress size={20}/>
                                    </TableCell>
                                </TableRow>
                            ) :
                            // Loading completed
                            (data.length === 0 ?
                                // Data is empty
                                <TableRow hover>
                                    <TableCell colSpan={columns.length}>
                                        {noDataMessage}
                                    </TableCell>
                                </TableRow> :
                                // Data is not empty
                                <>
                                    {table.getRowModel().rows.map((row) => (
                                        <TableRow key={row.id} hover>
                                            {row.getVisibleCells().map((cell) => (
                                                <TableCell key={cell.id}>
                                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))}
                                </>)
                    }
                </TableBody>
            </MuiTable>
        </TableContainer>
    )
}

const useStyles = tss
    .create(() => ({
        tableContainer: {
            border: `1px solid ${fr.colors.decisions.border.default.grey.default}`,
        },
        tableHead: {
            borderBottom: `3px solid ${fr.colors.decisions.border.plain.grey.default}`,
            th: {
                fontWeight: 700,
            }
        },
        isLoadingMessage: {
            display: 'flex',
            alignItems: 'center',
            gap: fr.spacing('3v')
        },
    }))
