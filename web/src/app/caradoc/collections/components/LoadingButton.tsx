import { Button, ButtonProps } from "@codegouvfr/react-dsfr/Button"
import { CircularProgress } from "@mui/material"
import { tss } from "tss-react"

type LoadingButtonProps = ButtonProps & {
    isLoading: boolean
}

/**
 * Enriches the react-dsfr Button component with a loading spinner
 * @param isLoading
 * @param props
 * @constructor
 */
export default function LoadingButton({isLoading, ...props}: LoadingButtonProps) {
    const {classes} = useStyles({isLoading})

    return (
        <div className={classes.container}>
            <Button {...props}
            >
                {props.children}
                {isLoading &&
                    <CircularProgress className={classes.spinner}
                                      size={20}
                                      thickness={5}
                                      sx={{color: 'inherit'}}/>}
            </Button>
        </div>
    )
}

const useStyles = tss
    .withParams<{ isLoading: boolean }>()
    .create(({isLoading}) => ({
        container: {
            position: 'relative',
            display: 'inline-block',
            'button::after': {
                visibility: isLoading ? 'hidden' : undefined,
            }
        },
        spinner: {
            position: 'absolute',
            right: 12,
            zIndex: 1,
        }
    }))