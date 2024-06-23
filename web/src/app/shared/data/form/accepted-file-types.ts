// We'll restrict the types of files that can be uploaded
export const ACCEPTED_FILE_TYPES = {
    'application/pdf': ['.pdf'],
    'application/vnd.oasis.opendocument.text': ['.odt'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'text/plain': ['.txt'],
    "text/markdown": ['.md'],
    "text/html": ['.html', '.htm'],
    "text/csv" : ['.csv']
}