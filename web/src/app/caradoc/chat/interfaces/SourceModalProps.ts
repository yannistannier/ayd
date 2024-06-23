import Source from "@/app/caradoc/chat/interfaces/Source"
import AnswerMode from "@/app/caradoc/chat/interfaces/AnswerMode"

export default interface SourceModalProps {
    source: Source
    indexPosition: number
    answerMode: AnswerMode
}