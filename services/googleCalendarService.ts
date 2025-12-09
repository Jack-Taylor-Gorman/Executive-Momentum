import { ScheduleEvent, EventType } from "../types";

// Types for the Google API globally available via script tags
declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

const SCOPES = 'https://www.googleapis.com/auth/calendar';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';

let tokenClient: any;
let gapiInited = false;
let gisInited = false;

// Robustly wait for a global variable to be defined (gapi or google)
const waitForGlobal = (key: 'gapi' | 'google', timeout = 5000): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (window[key]) return resolve();

    const start = Date.now();
    const interval = setInterval(() => {
      if (window[key]) {
        clearInterval(interval);
        resolve();
      } else if (Date.now() - start > timeout) {
        clearInterval(interval);
        reject(new Error(`Timeout: 'window.${key}' did not load. Check internet connection.`));
      }
    }, 100);
  });
};

/**
 * Pre-checks if the Google scripts are loaded on the page.
 * Call this inside a useEffect in the main app to "warm up" the scripts.
 */
export const preloadGoogleScripts = async () => {
  try {
    await Promise.all([waitForGlobal('gapi'), waitForGlobal('google')]);
    return true;
  } catch (e) {
    console.warn("Google scripts not detected during preload:", e);
    return false;
  }
};

export const initGapiClient = async (clientId: string): Promise<void> => {
  // 1. Ensure scripts are present
  await Promise.all([waitForGlobal('gapi'), waitForGlobal('google')]);

  // 2. Load GAPI Client Library
  if (!gapiInited) {
    await new Promise<void>((resolve, reject) => {
      window.gapi.load('client', {
        callback: resolve,
        onerror: () => reject(new Error("Failed to load gapi.client")),
      });
    });
    
    await window.gapi.client.init({
      discoveryDocs: [DISCOVERY_DOC],
    });
    gapiInited = true;
  }

  // 3. Initialize GIS (Token Client)
  if (!gisInited || !tokenClient) {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: () => {}, // Defined at request time via Promise wrapper below
    });
    gisInited = true;
  }
};

export const requestAccessToken = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error("Google Client not initialized."));
      return;
    }

    // Define the callback for this specific request
    tokenClient.callback = (resp: any) => {
      if (resp.error) {
        reject(resp);
      } else {
        resolve(resp);
      }
    };

    // Trigger the popup
    // Note: This must be called inside a user gesture handler (click) to avoid blocking
    if (window.gapi.client.getToken() === null) {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      tokenClient.requestAccessToken({ prompt: '' });
    }
  });
};

export const listUpcomingEvents = async (targetDate: Date): Promise<string> => {
  if (!gapiInited) throw new Error("GAPI not initialized");

  const timeMin = new Date(targetDate);
  timeMin.setHours(0, 0, 0, 0);
  
  const timeMax = new Date(targetDate);
  timeMax.setHours(23, 59, 59, 999);

  try {
    const response = await window.gapi.client.calendar.events.list({
      'calendarId': 'primary',
      'timeMin': timeMin.toISOString(),
      'timeMax': timeMax.toISOString(),
      'showDeleted': false,
      'singleEvents': true,
      'orderBy': 'startTime',
    });

    const events = response.result.items;
    
    if (!events || events.length === 0) {
      return "";
    }

    return events.map((event: any) => {
      const start = event.start.dateTime || event.start.date;
      const end = event.end.dateTime || event.end.date;
      
      let timeStr = "(All Day)";
      if (start.includes('T') && end.includes('T')) {
          const startTime = new Date(start).toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit', hour12: false});
          const endTime = new Date(end).toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit', hour12: false});
          timeStr = `${startTime}-${endTime}`;
      }
      
      return `[FIXED CALENDAR EVENT] ${timeStr}: ${event.summary}`;
    }).join('\n');

  } catch (err) {
    console.error("Error fetching events", err);
    throw new Error("Could not fetch calendar events.");
  }
};

export const exportScheduleToCalendar = async (events: ScheduleEvent[], targetDate: Date) => {
  if (!gapiInited) throw new Error("GAPI not initialized");
  
  const dateBase = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD
  let successCount = 0;

  for (const event of events) {
    if (event.completed) continue;
    
    const startDateTime = `${dateBase}T${event.startTime}:00`;
    const endDateTime = `${dateBase}T${event.endTime}:00`;

    // Map EventType to Google Calendar Colors
    let colorId = '1'; 
    switch(event.type) {
      case EventType.CRITICAL: colorId = '11'; break; // Red
      case EventType.FIXED: colorId = '8'; break; // Graphite
      case EventType.HIGH: colorId = '5'; break; // Yellow
      case EventType.LEISURE: colorId = '2'; break; // Sage
      case EventType.ROUTINE: colorId = '9'; break; // Blueberry
    }

    const gCalEvent = {
      'summary': `[Advisor] ${event.title}`,
      'description': event.description,
      'start': {
        'dateTime': startDateTime,
        'timeZone': Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      'end': {
        'dateTime': endDateTime,
        'timeZone': Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      'colorId': colorId
    };

    try {
      await window.gapi.client.calendar.events.insert({
        'calendarId': 'primary',
        'resource': gCalEvent,
      });
      successCount++;
    } catch (err) {
      console.error(`Failed to export event: ${event.title}`, err);
    }
  }
  return successCount;
};