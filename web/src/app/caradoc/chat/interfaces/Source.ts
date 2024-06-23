// As the File closely relates to the Source, let's include it into the Source file definition
export interface File {
    name: string
    type: string
    path?: string
    pageNumber?: number
}

export default interface Source {
    id: string
    content: string
    file: File
    score : number
}