import type { CalendarBridgePlugin, CalendarPermissionResult, CalendarInfo, CalendarEvent, AddEventOptions, UpdateEventOptions } from './calendar-bridge'

const STORAGE_KEY = 'focusflow-calendar-events'

function getStoredEvents(): CalendarEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveStoredEvents(events: CalendarEvent[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
}

let nextEventId = (() => {
  const events = getStoredEvents()
  return events.length > 0 ? Math.max(...events.map(e => e.id)) + 1 : 1
})()

export class CalendarBridgeWeb implements CalendarBridgePlugin {
  async checkPermission(): Promise<CalendarPermissionResult> {
    return { granted: true, read: true, write: true }
  }

  async requestPermission(): Promise<{ granted: boolean }> {
    return { granted: true }
  }

  async getCalendars(): Promise<{ calendars: CalendarInfo[] }> {
    return {
      calendars: [{
        id: 1,
        name: 'FocusFlow 日历',
        account: 'local',
        owner: 'FocusFlow',
      }],
    }
  }

  async getEvents(options: { calendarId: number; startTime: number; endTime: number }): Promise<{ events: CalendarEvent[] }> {
    const events = getStoredEvents()
    const filtered = events.filter(e =>
      e.calendarId === options.calendarId &&
      e.startTime < options.endTime &&
      e.endTime > options.startTime
    )
    return { events: filtered }
  }

  async addEvent(options: AddEventOptions): Promise<{ eventId: number; success: boolean }> {
    const events = getStoredEvents()
    const eventId = nextEventId++
    const newEvent: CalendarEvent = {
      id: eventId,
      title: options.title,
      description: options.description,
      startTime: options.startTime,
      endTime: options.endTime,
      location: options.location,
      calendarId: options.calendarId,
    }
    events.push(newEvent)
    saveStoredEvents(events)
    return { eventId, success: true }
  }

  async deleteEvent(options: { eventId: number }): Promise<{ success: boolean }> {
    const events = getStoredEvents()
    const filtered = events.filter(e => e.id !== options.eventId)
    saveStoredEvents(filtered)
    return { success: true }
  }

  async updateEvent(options: UpdateEventOptions): Promise<{ success: boolean }> {
    const events = getStoredEvents()
    const index = events.findIndex(e => e.id === options.eventId)
    if (index !== -1) {
      events[index] = {
        ...events[index],
        ...(options.title !== undefined && { title: options.title }),
        ...(options.description !== undefined && { description: options.description }),
        ...(options.startTime !== undefined && { startTime: options.startTime }),
        ...(options.endTime !== undefined && { endTime: options.endTime }),
        ...(options.location !== undefined && { location: options.location }),
      }
      saveStoredEvents(events)
    }
    return { success: true }
  }
}
