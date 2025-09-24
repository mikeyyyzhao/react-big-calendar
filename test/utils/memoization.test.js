import {
  compareLists,
  compareObjects,
  compareUnorderedLists,
} from '../../src/utils/memoization'

describe('compareLists', () => {
  test('it returns true if the lists are identical', () => {
    const list = ['foo', 'bar']
    expect(compareLists(list, list)).toBe(true)
  })

  test('it returns false if the lists have different lengths', () => {
    const listA = ['foo', 'bar']
    const listB = ['foo']
    expect(compareLists(listA, listB)).toBe(false)
    expect(compareLists(listB, listA)).toBe(false)
  })

  test('it returns false if two items are different', () => {
    const listA = ['foo', 'bar']
    const listB = ['foo', 'BAR']
    expect(compareLists(listA, listB)).toBe(false)
    expect(compareLists(listB, listA)).toBe(false)
  })

  test('it returns false if the order of items are inconsistent', () => {
    const listA = ['foo', 'bar']
    const listB = ['bar', 'foo']
    expect(compareLists(listA, listB)).toBe(false)
    expect(compareLists(listB, listA)).toBe(false)
  })

  test('it can use a custom comparator', () => {
    const comparator = (a, b) => a.length === b.length

    const listA = ['foo', 'fizz']
    const listB = ['bar', 'buzz']
    expect(compareLists(listA, listB, comparator)).toBe(true)
    expect(compareLists(listB, listA, comparator)).toBe(true)

    const listC = ['bar', 'buzzbuzz']
    expect(compareLists(listA, listC, comparator)).toBe(false)
    expect(compareLists(listC, listA, comparator)).toBe(false)
  })
})

describe('compareUnorderedLists', () => {
  test('it returns true if the lists are identical', () => {
    const list = ['foo', 'bar']
    expect(compareUnorderedLists(list, list)).toBe(true)
  })

  test('it returns false if the lists have different lengths', () => {
    const listA = ['foo', 'bar']
    const listB = ['foo']
    expect(compareUnorderedLists(listA, listB)).toBe(false)
    expect(compareUnorderedLists(listB, listA)).toBe(false)
  })

  test('it returns false if two items are different', () => {
    const listA = ['foo', 'bar']
    const listB = ['foo', 'BAR']
    expect(compareUnorderedLists(listA, listB)).toBe(false)
    expect(compareUnorderedLists(listB, listA)).toBe(false)
  })

  test('it returns true if the order of items are inconsistent', () => {
    const listA = ['foo', 'bar']
    const listB = ['bar', 'foo']
    expect(compareUnorderedLists(listA, listB)).toBe(true)
    expect(compareUnorderedLists(listB, listA)).toBe(true)
  })

  test('it can use a custom matcher and comparator', () => {
    const matcher = (a, b) => a.id === b.id
    const comparator = (a, b) => a.value === b.value

    const listA = [{ id: 1, value: true }]
    const listB = [{ id: 1, value: true }]
    expect(compareUnorderedLists(listA, listB, matcher, comparator)).toBe(true)
    expect(compareUnorderedLists(listB, listA, matcher, comparator)).toBe(true)

    const listC = [{ id: 1, value: false }]
    expect(compareUnorderedLists(listA, listC, matcher, comparator)).toBe(false)
    expect(compareUnorderedLists(listC, listA, matcher, comparator)).toBe(false)

    const listD = [{ id: 2, value: true }]
    expect(compareUnorderedLists(listA, listD, matcher, comparator)).toBe(false)
    expect(compareUnorderedLists(listD, listA, matcher, comparator)).toBe(false)
  })

  test('it considers duplicate items', () => {
    const listA = ['foo', 'foo', 'foo', 'bar', 'bar', 'bar']
    const listB = ['foo', 'bar', 'foo', 'bar', 'foo', 'bar']
    expect(compareUnorderedLists(listA, listB)).toBe(true)
    expect(compareUnorderedLists(listB, listA)).toBe(true)

    // Every item in listC exists in listA, but the quantities are different.
    const listC = ['foo', 'bar', 'foo', 'foo', 'foo', 'foo']
    expect(compareUnorderedLists(listA, listC)).toBe(false)
    expect(compareUnorderedLists(listC, listA)).toBe(false)
  })
})

describe('compareObjects', () => {
  test('it returns true if the objects are identical', () => {
    const testObject = {}
    expect(compareObjects(testObject, testObject)).toBe(true)
  })

  test('it returns false if the objects have different key counts', () => {
    const objectA = { key1: 'foo' }
    const objectB = { key1: 'foo', key2: 'foo' }

    expect(compareObjects(objectA, objectB)).toBe(false)
    expect(compareObjects(objectB, objectA)).toBe(false)
  })

  test('it returns false if the keys are different', () => {
    const objectA = { key1: 'foo' }
    const objectB = { key2: 'foo' }

    expect(compareObjects(objectA, objectB)).toBe(false)
    expect(compareObjects(objectB, objectA)).toBe(false)
  })

  test('it returns false if the values are different', () => {
    const objectA = { key1: {} }
    const objectB = { key1: {} }

    expect(compareObjects(objectA, objectB)).toBe(false)
    expect(compareObjects(objectB, objectA)).toBe(false)
  })

  test('it returns true if the values are the same', () => {
    const value = {}
    const objectA = { key1: value }
    const objectB = { key1: value }

    expect(compareObjects(objectA, objectB)).toBe(true)
    expect(compareObjects(objectB, objectA)).toBe(true)
  })

  test('it can ignore keys', () => {
    const options = { ignoredKeys: ['key2'] }

    const objectA = { key1: true, key2: true }
    const objectB = { key1: true }

    expect(compareObjects(objectA, objectB, options)).toBe(true)
    expect(compareObjects(objectB, objectA, options)).toBe(true)

    const objectC = { key1: true, key2: false }

    expect(compareObjects(objectA, objectC, options)).toBe(true)
    expect(compareObjects(objectC, objectA, options)).toBe(true)
  })

  test('it can override the comparator for specific keys', () => {
    const options = {
      comparators: {
        key1: (valueA, valueB) => valueA.length === valueB.length,
      },
    }
    const objectA = { key1: [1, 2], key2: true }
    const objectB = { key1: [3, 4], key2: true }

    expect(compareObjects(objectA, objectB, options)).toBe(true)
    expect(compareObjects(objectB, objectA, options)).toBe(true)
  })

  test('it can override the default comparator', () => {
    const options = {
      defaultComparator: (valueA, valueB) => valueA.length === valueB.length,
    }
    const objectA = { key1: [1, 2], key2: 'foo' }
    const objectB = { key1: [3, 4], key2: 'bar' }

    expect(compareObjects(objectA, objectB, options)).toBe(true)
    expect(compareObjects(objectB, objectA, options)).toBe(true)
  })
})
