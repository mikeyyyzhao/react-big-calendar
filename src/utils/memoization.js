/**
 * @template [T=Record<string, unknown>]
 * @param {T} objectA
 * @param {T} objectB
 * @param {Object} options
 *   optional. If excluded, the logic here should match React's default memoization logic.
 * @param {Partial<Record<keyof T, (valueA: any, valueB: any) => boolean>>=} options.comparators
 *   an object mapping keys of the objects to a comparator override.
 *   Useful if some keys are simple checks like strings/numbers but other keys need unique comparators
 * @param {(valueA: any, valueB: any) => boolean=} options.defaultComparator
 *   the fallback comparator if not explicitly defined in `comparators`.
 *   Defaults to `Object.is` to be consistent with React's default memoization logic
 * @param {(keyof T)[]=} options.ignoredKeys
 *   these keys will be ignored when comparing objects
 */
export function areObjectsEqual(
  objectA,
  objectB,
  { comparators = {}, defaultComparator = Object.is, ignoredKeys = [] } = {}
) {
  if (objectA === objectB) {
    return true
  }

  // If the number of checked keys has changed, we don't need to check any of the values.
  const ignoredKeysSet = new Set(ignoredKeys)
  const keysToCheckA = Object.keys(objectA).filter(
    (key) => !ignoredKeysSet.has(key)
  )
  const keysToCheckB = Object.keys(objectA).filter(
    (key) => !ignoredKeysSet.has(key)
  )
  if (keysToCheckA.length !== keysToCheckB.length) {
    return false
  }

  // If the number of checked keys is the same, we should check to make sure
  // the two lists of keys are the same.
  const checkedKeys = new Set()
  for (const key of keysToCheckA) {
    checkedKeys.add(key)
  }

  for (const key of keysToCheckB) {
    if (!checkedKeys.has(key)) {
      return false
    }
  }

  // If the number of checked keys is the same, we should check to make sure
  // the two lists of keys are the same.
  checkedKeys.forEach((key) => {
    const comparator = comparators[key] ?? defaultComparator
    if (!comparator(objectA[key], objectB[key])) {
      return false
    }
  })

  return true
}
