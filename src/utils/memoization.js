import * as dates from 'date-arithmetic'

// TODO: Set this to false.
export const DEBUG_MEMOIZATION = true

/**
 * Our custom event comparator.
 * @param {Object} prevEvent
 * @param {Object} nextEvent
 */
export function compareEvents(prevEvent, nextEvent) {
  return compareObjects(prevEvent, nextEvent, {
    comparators: {
      attendees: (...args) => compareLists(...args, compareObjects),
      conference_data: compareConferenceData,
      creator: compareObjects,
      event_start: compareObjects,
      eventStart: dates.eq,
      event_end: compareObjects,
      eventEnd: dates.eq,
      extended_properties: compareExtendedProperties,
      guest_permissions: compareObjects,
      mergedEvents: compareEventLists,
      organizer: compareObjects,
      original_start_time: compareObjects,
      rbcEventEnd: dates.eq,
      reminders: compareReminders,
      reschedules: compareReschedules,
      tags: (...args) => compareLists(...args, compareTags),
      working_location_properties: compareWorkingLocationProperties,
    },
    logDifferences: DEBUG_MEMOIZATION,
    from: 'compareEvents',
  })
}

function compareConferenceData(prevData, nextData) {
  return compareObjects(prevData, nextData, {
    comparators: {
      conferenceSolution: (...args) =>
        compareObjects(...args, { comparators: { key: compareObjects } }),
      createRequest: (...args) =>
        compareObjects(...args, {
          comparators: {
            conferenceSolutionKey: compareObjects,
            status: compareObjects,
          },
        }),
      entryPoints: (...args) => compareLists(...args, compareObjects),
    },
  })
}

function compareExtendedProperties(prevProperties, nextProperties) {
  return compareObjects(prevProperties, nextProperties, {
    comparators: {
      shared: compareObjects,
      private: compareObjects,
    },
  })
}

function compareReminders(prevReminders, nextReminders) {
  return compareObjects(prevReminders, nextReminders, {
    comparators: {
      overrides: (...args) => compareLists(...args, compareObjects),
    },
  })
}

function compareReschedules(prevReschedules, nextReschedules) {
  return compareObjects(prevReschedules, nextReschedules, {
    comparators: {
      tracked_changes: (...args) => compareLists(...args, compareObjects),
    },
  })
}

function compareTags(prevTag, nextTag) {
  return compareObjects(prevTag, nextTag, {
    comparators: {
      rules: (...args) =>
        compareObjects(...args, {
          comparators: {
            fields: (...args) => compareLists(...args, compareObjects),
          },
        }),
      user_tokens: compareUnorderedLists,
    },
  })
}

function compareWorkingLocationProperties(prevProperties, nextProperties) {
  return compareObjects(prevProperties, nextProperties, {
    comparators: {
      customLocation: compareObjects,
      officeLocation: compareObjects,
    },
    logDifferences: DEBUG_MEMOIZATION,
    from: 'compareWorkingLocationProperties',
  })
}

/**
 * Check if two events are the same by matching the user_event_id or id properties.
 * @param {Object} eventA
 * @param {Object} eventB
 */
export function matchEvent(eventA, eventB) {
  if (eventA.user_event_id) {
    return eventA.user_event_id === eventB.user_event_id
  }

  if (eventA.id) {
    return eventA.id === eventB.id
  }

  return false
}

/**
 * Checks if two lists events have the same events in the array, regardless of order.
 * When comparing events, we use our custom event comparator.
 * @param {Object[]} prevEvents
 * @param {Object[]} nextEvents
 */
function compareEventLists(prevEvents, nextEvents) {
  return compareUnorderedLists(
    prevEvents,
    nextEvents,
    matchEvent,
    compareEvents
  )
}

/**
 * Compares two lists, accounting for the order of the items.
 * @template T
 * @param {T[]} listA
 * @param {T[]} listB
 * @param {(itemA: T, itemB: T) => boolean} comparator
 */
export function compareLists(listA, listB, comparator = Object.is) {
  if (listA === listB) {
    return true
  }

  if (listA.length !== listB.length) {
    return false
  }

  for (let i = 0; i < listA.length; i++) {
    if (!comparator(listA[i], listB[i])) {
      return false
    }
  }

  return true
}

/**
 * Compare two lists, ignoring the order of the items.
 * @template T
 * @param {T[]} listA
 * @param {T[]} listB
 * @param {(itemA: T, itemB: T) => boolean} matcher
 *   a function to see if two items represent the same thing. This should be a quick check
 *   since this gets called for essentially every pair of items. If this is true, then the
 *   more complex comparator function will be called.
 * @param {(itemA: T, itemB: T) => boolean} comparator
 *   a function to see if two items are equal.
 */
export function compareUnorderedLists(
  listA,
  listB,
  matcher = Object.is,
  comparator = Object.is
) {
  if (listA === listB) {
    return true
  }

  if (listA.length !== listB.length) {
    return false
  }

  const matchedIndexes = new Set()
  for (const itemA of listA) {
    const indexB = listB.findIndex(
      (item, index) => !matchedIndexes.has(index) && matcher(itemA, item)
    )
    if (indexB === -1) {
      return false
    }

    matchedIndexes.add(indexB)
    const itemB = listB[indexB]

    if (!comparator(itemA, itemB)) {
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
 * @param {Boolean=} options.logDifferences
 *   a boolean to indicate if debug messages should be logged when objects change
 * @param {string=} options.from
 *   a string to help identify where a change is triggered from when debug is on
 */
export function compareObjects(
  objectA,
  objectB,
  {
    comparators = {},
    defaultComparator = Object.is,
    ignoredKeys = [],
    logDifferences,
    from,
  } = {}
) {
  if (objectA === objectB) {
    return true
  }

  // If the number of checked keys has changed, we don't need to check any of the values.
  const ignoredKeysSet = new Set(ignoredKeys)
  const keysToCheckA = Object.keys(objectA).filter(
    (key) => !ignoredKeysSet.has(key)
  )
  const keysToCheckB = Object.keys(objectB).filter(
    (key) => !ignoredKeysSet.has(key)
  )
  if (keysToCheckA.length !== keysToCheckB.length) {
    if (logDifferences) {
      console.info((from ? `[${from}] ` : '') + 'different object sizes')
    }
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
      if (logDifferences) {
        console.info((from ? `[${from}] ` : '') + 'missing key:' + key)
      }
      return false
    }
  }

  // If the number of checked keys is the same, we should check to make sure
  // the two lists of keys are the same.
  for (const key of checkedKeys) {
    const comparator = comparators[key] ?? defaultComparator
    if (!comparator(objectA[key], objectB[key])) {
      if (logDifferences) {
        console.info((from ? `[${from}] ` : '') + 'different values for key:', {
          key,
          valueA: objectA[key],
          valueB: objectB[key],
        })
      }
      return false
    }
  }

  return true
}
