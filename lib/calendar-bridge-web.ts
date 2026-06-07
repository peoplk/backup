import type { CalendarBridgePlugin, CalendarPermissionResult, CalendarInfo, CalendarEvent, AddEventOptions, UpdateEventOptions } from './calendar-bridge'

export class CalendarBridgeWeb implements CalendarBridgePlugin {
  async checkPermission(): Promise<CalendarPermissionResult> {
    return { granted: false, read: false, write: false }
  }

  async requestPermission(): Promise<{ granted: boolean }> {
    return { granted: false }
  }

  async getCalendars(): Promise<{ calendars: CalendarInfo[] }> {
    return { calendars: [] }
  }

  async getEvents(_options: { calendarId: number; startTime: number; endTime: number }): Promise<{ events: CalendarEvent[] }> {
    return { events: [] }
  }

  async addEvent(_options: AddEventOptions): Promise<{ eventId: number; success: boolean }> {
    return { eventId: 0, success: false }
  }

  async deleteEvent(_options: { eventId: number }): Promise<{ success: boolean }> {
    return { success: false }
  }

  async updateEvent(_options: UpdateEventOptions): Promise<{ success: boolean }> {
    return { success: false }
  }
}
