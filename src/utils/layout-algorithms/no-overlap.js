import { isHiddenEvent } from '../helpers'
import overlap from './overlap'

function getMaxIdxDFS(node, maxIdx, visited) {
  for (let i = 0; i < node.friends.length; ++i) {
    if (visited.indexOf(node.friends[i]) > -1) continue
    const friend = node.friends[i]

    // Skip hidden events when calculating max index
    if (isHiddenEvent(friend?.event)) {
      visited.push(friend)
      continue
    }

    maxIdx = maxIdx > friend.idx ? maxIdx : friend.idx
    // TODO : trace it by not object but kinda index or something for performance
    visited.push(friend)
    const newIdx = getMaxIdxDFS(friend, maxIdx, visited)
    maxIdx = maxIdx > newIdx ? maxIdx : newIdx
  }
  return maxIdx
}

// hidden events are 10px wide
export default function ({
  events,
  minimumStartDifference,
  slotMetrics,
  accessors,
}) {
  const styledEvents = overlap({
    events,
    minimumStartDifference,
    slotMetrics,
    accessors,
  })

  styledEvents.sort((a, b) => {
    a = a.style
    b = b.style
    if (a.top !== b.top) return a.top > b.top ? 1 : -1
    else return a.top + a.height < b.top + b.height ? 1 : -1
  })

  for (let i = 0; i < styledEvents.length; ++i) {
    styledEvents[i].friends = []
    delete styledEvents[i].style.left
    delete styledEvents[i].style.left
    delete styledEvents[i].idx
    delete styledEvents[i].size
  }

  for (let i = 0; i < styledEvents.length - 1; ++i) {
    const se1 = styledEvents[i]
    const y1 = se1.style.top
    const y2 = se1.style.top + se1.style.height

    for (let j = i + 1; j < styledEvents.length; ++j) {
      const se2 = styledEvents[j]
      const y3 = se2.style.top
      const y4 = se2.style.top + se2.style.height

      // be friends when overlapped
      if ((y3 <= y1 && y1 < y4) || (y1 <= y3 && y3 < y2)) {
        // TODO : hashmap would be effective for performance
        se1.friends.push(se2)
        se2.friends.push(se1)
      }
    }
  }

  for (let i = 0; i < styledEvents.length; ++i) {
    const se = styledEvents[i]

    // Hidden events always get idx 0
    if (isHiddenEvent(se?.event)) {
      se.idx = 0
      continue
    }

    const bitmap = []
    for (let j = 0; j < 100; ++j) bitmap.push(1) // 1 means available

    // Only consider visible friends when assigning indices
    for (let j = 0; j < se.friends.length; ++j)
      if (
        !isHiddenEvent(se.friends[j]?.event) &&
        se.friends[j].idx !== undefined
      )
        bitmap[se.friends[j].idx] = 0 // 0 means reserved

    se.idx = bitmap.indexOf(1)
  }

  for (let i = 0; i < styledEvents.length; ++i) {
    let size = 0

    if (styledEvents[i].size) continue

    // Skip size calculation for hidden events (they're always 10px)
    if (isHiddenEvent(styledEvents[i]?.event)) {
      styledEvents[i].size = 0
      continue
    }

    const allFriends = []
    const maxIdx = getMaxIdxDFS(styledEvents[i], 0, allFriends)

    // Check if there are any hidden events in this friend group
    const hasHiddenInGroup =
      allFriends.some((f) => isHiddenEvent(f?.event)) ||
      styledEvents[i].friends.some((f) => isHiddenEvent(f?.event))

    // If hidden events exist, reserve 10px; otherwise use full width
    if (hasHiddenInGroup) {
      size = (100 - 10) / (maxIdx + 1) // Divide remaining 90% among visible events
    } else {
      size = 100 / (maxIdx + 1)
    }

    styledEvents[i].size = size
    styledEvents[i].hasHiddenInGroup = hasHiddenInGroup

    for (let j = 0; j < allFriends.length; ++j) {
      if (!isHiddenEvent(allFriends[j]?.event)) {
        allFriends[j].size = size
        allFriends[j].hasHiddenInGroup = hasHiddenInGroup
      }
    }
  }

  for (let i = 0; i < styledEvents.length; ++i) {
    const e = styledEvents[i]

    // Handle hidden events separately
    if (isHiddenEvent(e?.event)) {
      e.style.left = 0
      e.style.width = '10px'
      e.style.height = `calc(${e.style.height}% - 2px)`
      e.style.xOffset = '0px'
      continue
    }

    // Calculate left position as percentage (within available space)
    e.style.left = e.idx * e.size

    // stretch to maximum (only consider visible friends)
    let maxIdx = 0
    for (let j = 0; j < e.friends.length; ++j) {
      if (!isHiddenEvent(e.friends[j]?.event)) {
        const idx = e.friends[j].idx
        maxIdx = maxIdx > idx ? maxIdx : idx
      }
    }

    if (maxIdx <= e.idx) {
      e.size = 100 - e.idx * e.size
    }

    // padding between events
    // for this feature, `width` is not percentage based unit anymore
    // it will be used with calc()
    const padding = e.idx === 0 ? 0 : 3
    // Account for container's margin-right when there are hidden events
    if (e.hasHiddenInGroup) {
      e.style.width = `calc(${e.size}% - ${padding}px - 10px)`
    } else {
      e.style.width = `calc(${e.size}% - ${padding}px)`
    }

    e.style.height = `calc(${e.style.height}% - 2px)`

    // If there's a hidden event in the group, offset by 10px
    const offsetPx = e.hasHiddenInGroup ? 10 : 0
    e.style.xOffset = `calc(${offsetPx}px + ${e.style.left}% + ${padding}px)`
  }

  return styledEvents
}
