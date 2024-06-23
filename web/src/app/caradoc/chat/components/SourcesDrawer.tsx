import { tss } from "tss-react"
import Drawer from '@mui/material/Drawer'
import Source from "@/app/caradoc/chat/interfaces/Source"
import SourceComponent from "@/app/caradoc/chat/components/Source"
import { fr } from "@codegouvfr/react-dsfr";
import { Button } from "@codegouvfr/react-dsfr/Button"
import AnswerMode from "@/app/caradoc/chat/interfaces/AnswerMode"

interface SourcesDrawerProps {
    open: boolean
    handleOpenSourceDetailModal: (source: Source, indexPosition: number, answerMode: AnswerMode) => () => void
    handleClose: () => void
    sources: Source[]
    answerMode: AnswerMode
}

/**
 * Lateral drawer containing the exhaustive list of sources
 * @param open
 * @param handleOpenSourceDetailModal
 * @param handleClose
 * @param sources
 * @param answerMode
 * @constructor
 */
export default function SourcesDrawer({
                                          open,
                                          handleOpenSourceDetailModal,
                                          handleClose,
                                          sources,
                                          answerMode,
                                      }: SourcesDrawerProps) {
    const {classes} = useStyles()
    return (
        <Drawer open={open}
                onClose={handleClose}
                anchor="right"
                disableEnforceFocus>
            <div className={classes.container}>
                <div className={classes.titleContainer}>
                    <h5>Sources</h5>
                    <Button
                        iconId="ri-arrow-right-double-line"
                        onClick={handleClose}
                        priority="tertiary no outline"
                        title="Fermer la liste des sources"
                    />
                </div>
                <div>
                    {
                        sources.map(
                            (source, index) =>
                                <div key={source.id}
                                     className={classes.source}>
                                    <SourceComponent
                                        indexPosition={index + 1}
                                        source={source}
                                        answerMode={answerMode}
                                        handleClick={handleOpenSourceDetailModal(source, index + 1, answerMode)}/>
                                </div>
                        )
                    }
                </div>
            </div>
        </Drawer>
    )
}

const maxDrawerWidth = 400

const useStyles = tss
    .create(() => ({
        container: {
            maxWidth: maxDrawerWidth,
            ...fr.spacing('padding', {top: '5w', rightLeft: '4w', bottom: '5w'}),
        },
        titleContainer: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: fr.spacing('4w'),
            h5: {
                margin: 0,
            },
            button: {
                color: "inherit",
            },
        },
        source: {
            marginBottom: fr.spacing('4w'),
        }
    }))