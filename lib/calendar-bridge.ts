import { registerPlugin } from '@capacitor/core'

export interface CalendarPermissionResult {
  granted: boolean
  read: boolean
  write: boolean
}

export interface CalendarInfo {
  id: number
  name: string
  account: string
  owner: string
}

export interface CalendarEvent {
  id: number
  title: string
  description?: string
  startTime: number
  endTime: number
  location?: string
  calendarId: number
}

export interface AddEventOptions {
  calendarId: number
  title: string
  description?: string
  startTime: number
  endTime: number
  location?: string
}

export interface UpdateEventOptions {
  eventId: number
  title?: string
  description?: string
  startTime?: number
  endTime?: number
  location?: string
}

export interface CalendarBridgePlugin {
  checkPermission(): Promise<CalendarPermissionResult>
  requestPermission(): Promise<{ granted: boolean }>
  getCalendars(): Promise<{ calendars: CalendarInfo[] }>
  getEvents(options: { calendarId: number; startTime: number; endTime: number }): Promise<{ events: CalendarEvent[] }>
  addEvent(options: AddEventOptions): Promise<{ eventId: number; success: boolean }>
  deleteEvent(options: { eventId: number }): Promise<{ success: boolean }>
  updateEvent(options: UpdateEventOptions): Promise<{ success: boolean }>
}

const CalendarBridge = registerPlugin<CalendarBridgePlugin>('CalendarBridge', {
  web: () => import('./calendar-bridge-web').then(m => new m.CalendarBridgeWeb()),
})

export { CalendarBridge }

export function isNativePlatform(): boolean {
  return typeof (window as any).Capacitor !== 'undefined' && (window as any).Capacitor.isNativePlatform()
}
