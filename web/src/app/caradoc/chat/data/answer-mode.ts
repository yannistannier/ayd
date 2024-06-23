import { fr } from "@codegouvfr/react-dsfr"

// Source origin might be a good variable name
export const answerModeData = {
    collection: {
        icon: 'ri-database-2-line',
        name: 'Collection',
        backgroundColor: fr.colors.decisions.background.contrast.blueFrance.default,
        color: fr.colors.decisions.text.label.blueFrance.default,
        description: 'Avec une collection parmi celles proposées dans la liste',
        placeholder: 'Discutez avec une collection',
    },
    file: {
        icon: 'ri-attachment-2',
        name: 'Fichier',
        backgroundColor: fr.colors.decisions.background.contrast.redMarianne.default,
        color: fr.colors.decisions.text.label.redMarianne.default,
        description: 'Avec vos propres documents après les avoir pré-chargés',
        placeholder: 'Discutez avec vos fichiers',
    },
}