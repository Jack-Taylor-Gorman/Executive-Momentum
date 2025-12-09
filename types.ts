export enum EventType {
  FIXED = 'FIXED',       // University, Sleep
  CRITICAL = 'CRITICAL', // DEFCON 0, P1
  HIGH = 'HIGH',         // P2
  ROUTINE = 'ROUTINE',   // Chores, Email
  LEISURE = 'LEISURE'    // Japanese corner
}

export interface ScheduleEvent {
  startTime: string; // HH:mm format (24h)
  endTime: string;   // HH:mm format (24h)
  title: string;
  description: string;
  type: EventType;
  durationMinutes: number;
  completed?: boolean;
}

export interface DailyPlanResponse {
  date: string;
  dayOfWeek: string;
  summary: string;
  events: ScheduleEvent[];
  momentumScore: number; // 0-100 estimate of productivity
}

export interface UserContext {
  profileName: string;
  rawContext: string;
}

export interface CalendarEvent {
  summary: string;
  start: { dateTime: string; date?: string };
  end: { dateTime: string; date?: string };
}