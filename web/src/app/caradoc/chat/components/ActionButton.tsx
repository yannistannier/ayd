import { CircularProgress, SxProps } from "@mui/material"
import { tss } from "tss-react"

interface ActionButtonProps {
    isLoading: boolean
    sx?: SxProps
}

/**
 * Generates a loading spinner around a rounded action button
 * @param isLoading loading state
 * @param sx MUI sx prop
 * @constructor
 */
export default function ActionButton({isLoading, sx}: ActionButtonProps) {
    const {classes} = useStyles()

    return (
        <div className={classes.actionButtonLoadingContainer}>
            {
                isLoading &&
                <CircularProgress className={classes.actionButtonLoading}
                                  size={34}
                                  thickness={3}
                                  sx={sx}/>
            }
        </div>
    )
}

const useStyles = tss
    .create(() => ({
        actionButtonLoadingContainer: {
            position: 'relative',
            transform: 'translate(3px, 3px)',
        },
        actionButtonLoading: {
            position: 'absolute',
        },
    }))
