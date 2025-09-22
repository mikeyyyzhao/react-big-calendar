import PropTypes from 'prop-types'
import React, { useEffect, useState } from 'react'
import { findDOMNode } from 'react-dom'
import clsx from 'clsx'

import Selection, { getBoundsForNode, isEvent } from './Selection'
import * as TimeSlotUtils from './utils/TimeSlots'
import { isSelected } from './utils/selection'

import { notify, hasStateOrPropsChanged } from './utils/helpers'
import * as DayEventLayout from './utils/DayEventLayout'
import TimeSlotGroup from './TimeSlotGroup'
import TimeGridEvent from './TimeGridEvent'
import { DayLayoutAlgorithmPropType } from './utils/propTypes'

import DayColumnWrapper from './DayColumnWrapper'
import { areObjectsEqual } from './utils/memoization'

class DayColumn extends React.Component {
  state = { selecting: false }

  constructor(...args) {
    super(...args)

    this.slotMetrics = TimeSlotUtils.getSlotMetrics(this.props)
  }

  componentDidMount() {
    this.props.selectable && this._selectable()
  }

  componentWillUnmount() {
    this._teardownSelectable()
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (nextProps.selectable && !this.props.selectable) this._selectable()
    if (!nextProps.selectable && this.props.selectable)
      this._teardownSelectable()

    this.slotMetrics = this.slotMetrics.update(nextProps)
  }

  shouldComponentUpdate(nextProps, nextState) {
    return hasStateOrPropsChanged(
      this.state,
      nextState,
      this.props,
      nextProps,
      [],
      false
    )
  }

  render() {
    const {
      date,
      max,
      rtl,
      isNow,
      resource,
      accessors,
      localizer,
      getters: { dayProp, ...getters },
      components: { eventContainerWrapper: EventContainer, ...components },
    } = this.props

    let { slotMetrics } = this
    let { selecting, top, height, startDate, endDate } = this.state

    let selectDates = { start: startDate, end: endDate }

    const { className, style } = dayProp(max)

    const DayColumnWrapperComponent =
      components.dayColumnWrapper || DayColumnWrapper

    return (
      <DayColumnWrapperComponent
        date={date}
        style={style}
        className={clsx(
          className,
          'rbc-day-slot',
          'rbc-time-column',
          isNow && 'rbc-now',
          isNow && 'rbc-today', // WHY
          selecting && 'rbc-slot-selecting'
        )}
        slotMetrics={slotMetrics}
      >
        <MemoizedSlotGroups
          slotGroups={slotMetrics.groups}
          resource={resource}
          getters={getters}
          components={components}
        />
        <EventContainer
          localizer={localizer}
          resource={resource}
          accessors={accessors}
          getters={getters}
          components={components}
          slotMetrics={slotMetrics}
        >
          <div className={clsx('rbc-events-container', rtl && 'rtl')}>
            {this.renderEvents({
              events: this.props.backgroundEvents,
              isBackgroundEvent: true,
            })}
            {this.renderEvents({ events: this.props.events })}
          </div>
        </EventContainer>

        {selecting && (
          <div className="rbc-slot-selection" style={{ top, height }}>
            <span>{localizer.format(selectDates, 'selectRangeFormat')}</span>
          </div>
        )}
        <TimeIndicator
          getNow={this.props.getNow}
          isNow={isNow}
          min={this.props.min}
          max={this.props.max}
          slotMetrics={slotMetrics}
        />
      </DayColumnWrapperComponent>
    )
  }

  renderEvents = ({ events, isBackgroundEvent }) => {
    let {
      rtl,
      selected,
      accessors,
      localizer,
      getters,
      components,
      step,
      timeslots,
      dayLayoutAlgorithm,
      resizable,
    } = this.props

    const { slotMetrics } = this
    const { messages } = localizer

    let styledEvents = DayEventLayout.getStyledEvents({
      events,
      accessors,
      slotMetrics,
      minimumStartDifference: Math.ceil((step * timeslots) / 2),
      dayLayoutAlgorithm,
    })

    return styledEvents.map(({ event, style }, idx) => {
      let end = accessors.end(event)
      let start = accessors.start(event)
      let format = 'eventTimeRangeFormat'
      let label

      const startsBeforeDay = slotMetrics.startsBeforeDay(start)
      const startsAfterDay = slotMetrics.startsAfterDay(end)

      if (startsBeforeDay) format = 'eventTimeRangeEndFormat'
      else if (startsAfterDay) format = 'eventTimeRangeStartFormat'

      if (startsBeforeDay && startsAfterDay) label = messages.allDay
      else label = localizer.format({ start, end }, format)

      let continuesPrior = startsBeforeDay || slotMetrics.startsBefore(start)
      let continuesAfter = startsAfterDay || slotMetrics.startsAfter(end)

      return (
        <TimeGridEvent
          style={style}
          event={event}
          label={label}
          // Make the key unique and constant.
          key={accessors.key(event) ?? 'evt_' + idx}
          getters={getters}
          rtl={rtl}
          components={components}
          continuesPrior={continuesPrior}
          continuesAfter={continuesAfter}
          accessors={accessors}
          selected={isSelected(event, selected)}
          onClick={(e) => this._select(event, e)}
          onDoubleClick={(e) => this._doubleClick(event, e)}
          isBackgroundEvent={isBackgroundEvent}
          onKeyPress={(e) => this._keyPress(event, e)}
          resizable={resizable}
        />
      )
    })
  }

  _selectable = () => {
    let node = findDOMNode(this)
    const { longPressThreshold, localizer } = this.props
    let selector = (this._selector = new Selection(() => findDOMNode(this), {
      longPressThreshold: longPressThreshold,
    }))

    let maybeSelect = (box) => {
      let onSelecting = this.props.onSelecting
      let current = this.state || {}
      let state = selectionState(box)
      let { startDate: start, endDate: end } = state

      if (onSelecting) {
        if (
          (localizer.eq(current.startDate, start, 'minutes') &&
            localizer.eq(current.endDate, end, 'minutes')) ||
          onSelecting({ start, end, resourceId: this.props.resource }) === false
        )
          return
      }

      if (
        this.state.start !== state.start ||
        this.state.end !== state.end ||
        this.state.selecting !== state.selecting
      ) {
        this.setState(state)
      }
    }

    let selectionState = (point) => {
      let currentSlot = this.slotMetrics.closestSlotFromPoint(
        point,
        getBoundsForNode(node)
      )

      if (!this.state.selecting) {
        this._initialSlot = currentSlot
      }

      let initialSlot = this._initialSlot
      if (localizer.lte(initialSlot, currentSlot)) {
        currentSlot = this.slotMetrics.nextSlot(currentSlot)
      } else if (localizer.gt(initialSlot, currentSlot)) {
        initialSlot = this.slotMetrics.nextSlot(initialSlot)
      }

      const selectRange = this.slotMetrics.getRange(
        localizer.min(initialSlot, currentSlot),
        localizer.max(initialSlot, currentSlot)
      )

      return {
        ...selectRange,
        selecting: true,

        top: `${selectRange.top}%`,
        height: `${selectRange.height}%`,
      }
    }

    let selectorClicksHandler = (box, actionType) => {
      if (!isEvent(findDOMNode(this), box)) {
        const { startDate, endDate } = selectionState(box)
        this._selectSlot({
          startDate,
          endDate,
          action: actionType,
          box,
        })
      }
      this.setState({ selecting: false })
    }

    selector.on('selecting', maybeSelect)
    selector.on('selectStart', maybeSelect)

    selector.on('beforeSelect', (box) => {
      if (this.props.selectable !== 'ignoreEvents') return

      return !isEvent(findDOMNode(this), box)
    })

    selector.on('click', (box) => selectorClicksHandler(box, 'click'))

    selector.on('doubleClick', (box) =>
      selectorClicksHandler(box, 'doubleClick')
    )

    selector.on('select', (bounds) => {
      if (this.state.selecting) {
        this._selectSlot({ ...this.state, action: 'select', bounds })
        this.setState({ selecting: false })
      }
    })

    selector.on('reset', () => {
      if (this.state.selecting) {
        this.setState({ selecting: false })
      }
    })
  }

  _teardownSelectable = () => {
    if (!this._selector) return
    this._selector.teardown()
    this._selector = null
  }

  _selectSlot = ({ startDate, endDate, action, bounds, box }) => {
    let current = startDate,
      slots = []

    while (this.props.localizer.lte(current, endDate)) {
      slots.push(current)
      current = new Date(+current + this.props.step * 60 * 1000) // using Date ensures not to create an endless loop the day DST begins
    }

    notify(this.props.onSelectSlot, {
      slots,
      start: startDate,
      end: endDate,
      resourceId: this.props.resource,
      action,
      bounds,
      box,
    })
  }

  _select = (...args) => {
    notify(this.props.onSelectEvent, args)
  }

  _doubleClick = (...args) => {
    notify(this.props.onDoubleClickEvent, args)
  }

  _keyPress = (...args) => {
    notify(this.props.onKeyPressEvent, args)
  }
}

DayColumn.propTypes = {
  events: PropTypes.array.isRequired,
  backgroundEvents: PropTypes.array.isRequired,
  step: PropTypes.number.isRequired,
  date: PropTypes.instanceOf(Date).isRequired,
  min: PropTypes.instanceOf(Date).isRequired,
  max: PropTypes.instanceOf(Date).isRequired,
  getNow: PropTypes.func.isRequired,
  isNow: PropTypes.bool,

  rtl: PropTypes.bool,
  resizable: PropTypes.bool,

  accessors: PropTypes.object.isRequired,
  components: PropTypes.object.isRequired,
  getters: PropTypes.object.isRequired,
  localizer: PropTypes.object.isRequired,

  showMultiDayTimes: PropTypes.bool,
  culture: PropTypes.string,
  timeslots: PropTypes.number,

  selected: PropTypes.object,
  selectable: PropTypes.oneOf([true, false, 'ignoreEvents']),
  eventOffset: PropTypes.number,
  longPressThreshold: PropTypes.number,

  onSelecting: PropTypes.func,
  onSelectSlot: PropTypes.func.isRequired,
  onSelectEvent: PropTypes.func.isRequired,
  onDoubleClickEvent: PropTypes.func.isRequired,
  onKeyPressEvent: PropTypes.func,

  className: PropTypes.string,
  dragThroughEvents: PropTypes.bool,
  resource: PropTypes.any,

  dayLayoutAlgorithm: DayLayoutAlgorithmPropType,
}

DayColumn.defaultProps = {
  dragThroughEvents: true,
  timeslots: 2,
}

/**
 * @param {Object} props
 * @param {() => Date} props.getNow
 * @param {boolean=} props.isNow
 * @param {Date} props.max
 * @param {Date} props.min
 * @param {Object} props.slotMetrics
 */
function TimeIndicator({ getNow, isNow, max, min, slotMetrics }) {
  const [position, setPosition] = useState(0)

  const isTimeoutRunning = (() => {
    if (!isNow) {
      return false
    }

    const current = getNow()
    return current >= min && current <= max
  })()

  useEffect(() => {
    if (!isTimeoutRunning) {
      return
    }

    const recalculatePosition = () => {
      const current = getNow()
      const top = slotMetrics.getCurrentTimePosition(current)
      setPosition(top)
    }

    recalculatePosition()
    const interval = window.setInterval(() => {
      recalculatePosition()
    }, 60000)

    return () => {
      window.clearInterval(interval)
    }
  }, [getNow, isTimeoutRunning, slotMetrics])

  if (!isTimeoutRunning) {
    return null
  }

  return (
    <div
      className="rbc-current-time-indicator"
      style={{ top: `${position}%` }}
    />
  )
}

function SlotGroups({ slotGroups, resource, getters, components }) {
  return (
    <>
      {slotGroups.map((grp, idx) => (
        <TimeSlotGroup
          key={idx}
          group={grp}
          resource={resource}
          getters={getters}
          components={components}
        />
      ))}
    </>
  )
}

const MemoizedSlotGroups = React.memo(SlotGroups, (prevProps, nextProps) => {
  for (const key in prevProps) {
    if (['getters', 'components'].includes(key)) {
      if (!areObjectsEqual(prevProps[key], nextProps[key])) {
        return false
      }
    } else {
      if (!Object.is(prevProps[key], nextProps[key])) {
        return false
      }
    }
  }
  return true
})

export default DayColumn
