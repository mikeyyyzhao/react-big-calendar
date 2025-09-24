/**
 * Find a matching event in a list by the event's user_event_id if it exists.
 * Otherwise search by the event's id.
 * @param {Object} event the event to find
 * @param {Object[]} events the list of events to search
 */
function findMatchingEvent(event, events) {
  if (event.user_event_id) {
    return events.find((e) => e.user_event_id === event.user_event_id)
  }

  if (event.id) {
    return events.find((e) => e.id === event.id)
  }
}

/**
 * Our custom event comparator.
 * @param {Object} prevEvent
 * @param {Object} nextevent
 */
export function compareEvents(prevEvent, nextEvent) {
  return compareObjects(prevEvent, nextEvent, {
    comparators: {
      mergedEvents: compareEventLists,
    },
  })
}

/**
 * Checks if two lists events have the same events in the array, regardless of order.
 * When comparing events, we use our custom event comparator.
 */
function compareEventLists(prevEvents, nextEvents) {
  if (prevEvents.length !== nextEvents.length) {
    return false
  }

  for (const prevEvent of prevEvents) {
    const nextEvent = findMatchingEvent(prevEvent, nextEvents)
    if (!nextEvent || !compareEvents(prevEvent, nextEvent)) {
      return false
    }
  }

  return true
}

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
export function compareObjects(
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
