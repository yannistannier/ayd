"use client"

import { tss } from "tss-react"
import { fr } from "@codegouvfr/react-dsfr"
import { dayjs } from "@/app/shared/utils/date"

interface DateCellProps {
    date: Date
}

/**
 * Date cell representation
 * @param date
 * @constructor
 */
export default function DateCell({date}: DateCellProps) {
    const {classes} = useStyles()
    // Fixme: for some weird reason the data is stored in the correct ISO 8601 format on the database but get serialized incorrectly
    const currentDate = `${date}Z`
    return (
        <div className={classes.container}>
            <i className="ri-calendar-event-line"/>
            <div>{dayjs(currentDate).format('DD/MM/YYYY')}</div>
            <div className={classes.time}>{dayjs(currentDate).format('HH[h]mm')}</div>
        </div>
    )
}

const useStyles = tss
    .create(() => ({
        container: {
            display: 'flex',
            alignItems: 'center',
            gap: fr.spacing('3v')
        },
        time: {
            color: fr.colors.decisions.text.disabled.grey.default,
        }
    }))
