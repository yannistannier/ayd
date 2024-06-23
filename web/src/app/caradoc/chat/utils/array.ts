// Fixme: remove util function if not used
const getRandomValuesArray = <T>(array: T[]): T[] => {
    // Shuffle the array
    const shuffledArray = array.slice().sort(() => Math.random() - 0.5);
    // Generate a random size for the resulting array (at least 1)
    const size = Math.max(1, Math.floor(Math.random() * (shuffledArray.length + 1)));
    // Take the first 'size' elements
    return shuffledArray.slice(0, size);
}

export { getRandomValuesArray }