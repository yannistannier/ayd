/**
 * Depending on the user's interactions with the UI, we'll need to perform different actions when clearing the attached files
 * 'trigger' refers to the action that triggered the files deletion | for now, it can be a click on the reset button
 */
export default interface FilesDeletionData {
    trigger: 'resetButton'
}