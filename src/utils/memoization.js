/**
 * @template [T=Record<string, unknown>]
 * @param {T} objectA
 * @param {T} objectB
 * @param {(valueA: any, valueB: any) => boolean} comparator
 */
export function areObjectsEqual(objectA, objectB, comparator = Object.is) {
  if (objectA === objectB) {
    return true
  }

  if (Object.keys(objectA).length !== Object.keys(objectB).length) {
    return false
  }

  const objectKeys = new Set()
  for (const key in objectA) {
    objectKeys.add(key)
  }

  for (const key in objectB) {
    if (!objectKeys.has(key)) {
      return false
    }
  }

  for (const key in objectB) {
    if (!comparator(objectA[key], objectB[key])) {
      return false
    }
  }

  return true
}
