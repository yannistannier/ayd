import { camelCase, isArray, isPlainObject, mapKeys, mapValues, snakeCase } from 'lodash'

/**
 * Converts an object from snake_case to camelCase
 * @param obj
 */
const toCamelCase: any = (obj: any) => {
    if (isArray(obj)) {
        return obj.map(toCamelCase)
    } else if (isPlainObject(obj)) {
        return mapKeys(mapValues(obj, toCamelCase), (_, key) =>
            camelCase(key)
        )
    }
    return obj
}

/**
 * Converts an object from camelCase to snake_case
 * @param obj
 */
const toSnakeCase: any = (obj: any) => {
    if (isArray(obj)) {
        return obj.map(toSnakeCase)
    } else if (isPlainObject(obj)) {
        return mapKeys(mapValues(obj, toSnakeCase), (_, key) =>
            snakeCase(key)
        )
    }
    return obj
}

export { toCamelCase, toSnakeCase }