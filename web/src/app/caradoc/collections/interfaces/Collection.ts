import CollectionFile from "@/app/caradoc/collections/interfaces/File";

export interface Collection {
    id: string
    name: string
    createdAt: Date
    updatedAt: Date
    nbFiles?: number
    files: CollectionFile[]
}