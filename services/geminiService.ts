import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ScheduleEvent, DailyPlanResponse } from "../types";

const getAIClient = () => {
  let apiKey = "";
  try {
    // Safely check if process is defined before accessing it
    if (typeof process !== "undefined" && process.env) {
      apiKey = process.env.API_KEY || "";
    }
  } catch (e) {
    console.error("Error accessing process.env", e);
  }

  if (!apiKey) {
    // Fallback or specific error if needed, but preventing the crash is priority
    throw new Error("API_KEY is missing. Ensure process.env.API_KEY is available.");
  }
  return new GoogleGenAI({ apiKey });
};

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    date: { type: Type.STRING, description: "YYYY-MM-DD" },
    dayOfWeek: { type: Type.STRING },
    summary: { type: Type.STRING, description: "A brief executive summary of the day's strategy." },
    momentumScore: { type: Type.INTEGER, description: "Predicted productivity score 0-100" },
    events: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          startTime: { type: Type.STRING, description: "24h format HH:mm" },
          endTime: { type: Type.STRING, description: "24h format HH:mm" },
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          type: { 
            type: Type.STRING, 
            enum: ['FIXED', 'CRITICAL', 'HIGH', 'ROUTINE', 'LEISURE'] 
          },
          durationMinutes: { type: Type.INTEGER }
        },
        required: ["startTime", "endTime", "title", "type"]
      }
    }
  },
  required: ["date", "events", "summary", "momentumScore"]
};

export const generateDailySchedule = async (
  contextData: string, 
  targetDate: Date,
  importedEvents: string = ""
): Promise<DailyPlanResponse> => {
  
  const ai = getAIClient();
  const dayName = targetDate.toLocaleDateString('en-US', { weekday: 'long' });
  const dateStr = targetDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const prompt = `
    You are an Executive Function Architect for a high-performance entrepreneur.
    
    Target Date: ${dayName}, ${dateStr}.
    
    Current Context & Constraints:
    ${contextData}

    REAL-WORLD HARD CONSTRAINTS (Google Calendar):
    ${importedEvents ? importedEvents : "No external calendar events found."}
    
    Task:
    Generate a highly optimized, time-blocked schedule for this specific day.
    
    Rules:
    1. Respect the "Sleep Cycle" implicitly (Start the day at the wake-up time, end at sleep time).
    2. STRICTLY enforce "Fixed Blocks" from the User Context (University classes).
    3. STRICTLY enforce "REAL-WORLD HARD CONSTRAINTS" provided above. Do not double book these times. Treat them as FIXED.
    4. STRICTLY enforce "DEFCON 0" priorities. If a conflict exists with business work, DEFCON 0 wins.
    5. Fill "Deep Work" gaps (especially early morning 2AM-8AM) with the highest priority available tasks.
    6. Batch administrative tasks/chores into low-energy windows.
    7. Return the schedule as a structured JSON object.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        systemInstruction: "You are a ruthless priority manager. You maximize output by arranging tasks logically around fixed constraints.",
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text) as DailyPlanResponse;
  } catch (error) {
    console.error("Gemini Scheduling Error:", error);
    throw error;
  }
};