import React, { useState, useEffect, useMemo } from 'react';
import { JACK_GORMAN_CONTEXT, GOOGLE_CLIENT_ID } from './constants';
import { generateDailySchedule } from './services/geminiService';
import { initGapiClient, requestAccessToken, listUpcomingEvents, exportScheduleToCalendar, preloadGoogleScripts } from './services/googleCalendarService';
import { DailyPlanResponse } from './types';
import { TimelineEvent } from './components/TimelineEvent';
import { ContextEditor } from './components/ContextEditor';
import { CredentialsModal } from './components/CredentialsModal';

const STORAGE_KEYS = {
  CONTEXT: 'executive_context',
  PLAN_PREFIX: 'executive_plan_'
};

const App: React.FC = () => {
  // 1. Initialize Context from Storage or Default
  const [context, setContext] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEYS.CONTEXT) || JACK_GORMAN_CONTEXT;
    }
    return JACK_GORMAN_CONTEXT;
  });

  // Calculate "Tomorrow" once per session to ensure stable keys
  const tomorrow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  }, []);

  // 2. Initialize Plan from Storage if available for the specific date
  const planKey = `${STORAGE_KEYS.PLAN_PREFIX}${tomorrow.toISOString().split('T')[0]}`;
  
  const [plan, setPlan] = useState<DailyPlanResponse | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(planKey);
      try {
        return saved ? JSON.parse(saved) : null;
      } catch (e) {
        console.error("Failed to parse saved plan", e);
        return null;
      }
    }
    return null;
  });

  const [loading, setLoading] = useState(false);
  
  // UI States
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isCredsModalOpen, setIsCredsModalOpen] = useState(false);
  const [synced, setSynced] = useState(false);
  
  // Connection states
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [, setScriptsLoaded] = useState(false); // Used for trigger re-renders if needed
  
  const [importedEvents, setImportedEvents] = useState<string>("");

  // Persist Context changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CONTEXT, context);
  }, [context]);

  // Persist Plan changes (including checkbox toggles)
  useEffect(() => {
    if (plan) {
      localStorage.setItem(planKey, JSON.stringify(plan));
    }
  }, [plan, planKey]);

  // Preload scripts on mount
  useEffect(() => {
    preloadGoogleScripts().then((loaded) => {
      setScriptsLoaded(loaded);
      // Attempt silent init if we have a hardcoded ID or a stored one
      const targetId = GOOGLE_CLIENT_ID || localStorage.getItem('gcal_client_id');
      if (loaded && targetId) {
        initGapiClient(targetId).catch(err => console.error("Silent init failed", err));
      }
    });
  }, []);

  const initiateConnection = async (clientId: string, forceConsent = false) => {
    setConnecting(true);
    try {
      // Only store in local storage if it's NOT the hardcoded one (keep LS clean)
      if (!GOOGLE_CLIENT_ID) {
        localStorage.setItem('gcal_client_id', clientId);
      }
      
      await initGapiClient(clientId);
      await requestAccessToken(forceConsent);
      setCalendarConnected(true);
      
      const eventsStr = await listUpcomingEvents(tomorrow);
      setImportedEvents(eventsStr);
      
      setIsCredsModalOpen(false);

    } catch (err: any) {
      console.error("Connection failed:", err);
      const msg = err.error || err.message || JSON.stringify(err);
      
      if (msg === "popup_closed_by_user") {
        // Ignore user cancellation
      } else {
        const currentOrigin = window.location.origin;
        
        // Handle "Access Denied" specifically (403)
        if (msg.includes('access_denied') || msg.includes('403')) {
             if (confirm(`Connection Rejected (403 Forbidden).\n\nThis almost always means the URL "${currentOrigin}" is not whitelisted in your Google Cloud Console.\n\nOpen Settings to see instructions?`)) {
               setIsCredsModalOpen(true);
             }
        } 
        // Handle Storage Relay / Origin Mismatch
        else if (msg.includes('storagerelay') || msg.includes('invalid_request') || msg.includes('400')) {
             if (confirm(`Configuration Mismatch.\n\nEnsure "${currentOrigin}" is added to Authorized Origins & Redirect URIs.\n\nOpen Settings?`)) {
               setIsCredsModalOpen(true);
             }
        } else {
             alert(`Connection Error: ${msg}\n\nPlease check your Client ID.`);
        }
        
        if (!GOOGLE_CLIENT_ID) {
            // Optional: don't clear it immediately so they can edit it
            // localStorage.removeItem('gcal_client_id');
        }
      }
      setCalendarConnected(false);
    } finally {
      setConnecting(false);
    }
  };

  const handleConnectClick = () => {
    if (GOOGLE_CLIENT_ID) {
      initiateConnection(GOOGLE_CLIENT_ID);
      return;
    }

    const storedId = localStorage.getItem('gcal_client_id');
    if (storedId) {
      initiateConnection(storedId);
    } else {
      setIsCredsModalOpen(true);
    }
  };

  const handleClearCredentials = () => {
    if(confirm("Disconnect Google Calendar?")) {
      localStorage.removeItem('gcal_client_id');
      setCalendarConnected(false);
      setImportedEvents("");
    }
  }

  const handleGenerate = async () => {
    setLoading(true);
    setSynced(false);
    
    let currentImportedEvents = importedEvents;
    
    // Refresh events if connected
    if (calendarConnected) {
      try {
        currentImportedEvents = await listUpcomingEvents(tomorrow);
        setImportedEvents(currentImportedEvents);
      } catch (e) {
        console.warn("Could not refresh events, using cached", e);
      }
    }

    try {
      const generatedPlan = await generateDailySchedule(context, tomorrow, currentImportedEvents);
      setPlan(generatedPlan);
    } catch (error) {
      console.error(error);
      alert("Failed to generate schedule.");
    } finally {
      setLoading(false);
    }
  };

  const handleExportToCalendar = async () => {
    if (!plan || !calendarConnected) {
      alert("Please connect your Google Calendar first!");
      handleConnectClick();
      return;
    }

    if (confirm(`Export ${plan.events.length} events to your Google Calendar for ${plan.date}?`)) {
       try {
         const count = await exportScheduleToCalendar(plan.events, tomorrow);
         setSynced(true);
         alert(`Successfully exported ${count} events.`);
         setTimeout(() => setSynced(false), 5000);
       } catch (error) {
         console.error("Export failed:", error);
         alert("Failed to export events.");
       }
    }
  };

  const toggleEventCompletion = (index: number) => {
    if (!plan) return;
    const newEvents = [...plan.events];
    newEvents[index] = {
      ...newEvents[index],
      completed: !newEvents[index].completed
    };
    setPlan({ ...plan, events: newEvents });
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans selection:bg-blue-500/30">
      
      {/* Header */}
      <header className="sticky top-0 z-30 bg-gray-950/80 backdrop-blur-md border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              EXECUTIVE <span className="text-blue-500">MOMENTUM</span>
            </h1>
            <p className="text-xs text-gray-500 uppercase tracking-widest">
              Priority Management System
            </p>
          </div>
          <div className="flex gap-3 items-center">
            {calendarConnected ? (
               <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded px-3 py-1.5">
                  <span className="text-xs font-bold text-green-400 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                    CALENDAR LINKED
                  </span>
                  <button 
                    type="button"
                    onClick={handleClearCredentials} 
                    className="text-xs text-gray-600 hover:text-red-400 ml-2 border-l border-gray-800 pl-2"
                  >
                    Disconnect
                  </button>
               </div>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleConnectClick}
                  disabled={connecting}
                  className={`text-xs font-bold uppercase tracking-wide border border-gray-700 px-4 py-2 rounded hover:border-gray-500 transition-all ${
                    connecting ? 'text-blue-400 cursor-wait bg-blue-900/10' : 'text-gray-300 hover:text-white hover:bg-gray-900'
                  }`}
                >
                  {connecting ? 'Connecting...' : 'Connect Calendar'}
                </button>
                {/* Gear Icon for manual settings if needed */}
                {!connecting && (
                  <button
                     type="button"
                     onClick={() => setIsCredsModalOpen(true)}
                     className="p-2 text-gray-600 hover:text-white transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                )}
              </div>
            )}
            
             <button
              type="button"
              onClick={() => setIsEditorOpen(true)}
              className="text-xs font-bold uppercase tracking-wide text-gray-500 hover:text-white transition-colors px-2"
            >
              Edit Context
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading}
              className={`px-5 py-2 rounded font-bold text-sm transition-all ${
                loading 
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                  : 'bg-white text-gray-900 hover:bg-gray-200 shadow-[0_0_20px_rgba(255,255,255,0.15)] hover:shadow-[0_0_25px_rgba(255,255,255,0.25)]'
              }`}
            >
              {loading ? 'ARCHITECTING...' : 'GENERATE PLAN'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        
        {/* Empty State */}
        {!plan && !loading && (
          <div className="text-center py-20 opacity-50 animate-fade-in select-none">
            <div className="text-7xl mb-6 grayscale opacity-50">🦅</div>
            <h2 className="text-3xl font-bold mb-3 tracking-tight">Ready to Lead</h2>
            <p className="max-w-md mx-auto mb-8 text-gray-400 leading-relaxed">
              Connect your calendar to sync real-world constraints, then generate a ruthless timeline for tomorrow.
            </p>
            {calendarConnected && importedEvents && (
               <div className="bg-gray-900/50 inline-block p-5 rounded-lg text-left text-sm max-w-lg border border-gray-800 shadow-2xl backdrop-blur-sm">
                 <p className="text-green-500 mb-3 text-[10px] uppercase font-bold tracking-widest flex items-center gap-2">
                   <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                   Live Constraints Detected
                 </p>
                 <pre className="whitespace-pre-wrap font-mono text-xs text-gray-300 overflow-x-auto">{importedEvents}</pre>
               </div>
            )}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="py-32 flex flex-col items-center justify-center space-y-6">
             <div className="relative">
                <div className="w-16 h-16 border-4 border-gray-800 rounded-full"></div>
                <div className="absolute top-0 w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
             </div>
             <div className="text-center">
               <p className="text-white font-bold text-lg animate-pulse">Analyzing Priorities</p>
               <p className="text-gray-500 text-sm mt-1">Cross-referencing constraints with objectives...</p>
             </div>
          </div>
        )}

        {/* Plan View */}
        {plan && !loading && (
          <div className="space-y-8 animate-fade-in pb-20">
            
            {/* Executive Summary Card */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 rounded-xl p-8 shadow-2xl relative overflow-hidden group">
              <div className="absolute -top-10 -right-10 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all duration-1000"></div>
              
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-4xl font-black text-white tracking-tight mb-1">{plan.dayOfWeek}</h2>
                    <p className="text-blue-500 font-mono text-sm tracking-wide">{plan.date}</p>
                  </div>
                  <div className="text-right">
                    <span className="block text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">Momentum Score</span>
                    <span className={`text-4xl font-black ${
                      plan.momentumScore > 80 ? 'text-green-400' : 'text-yellow-400'
                    }`}>{plan.momentumScore}</span>
                  </div>
                </div>
                
                <div className="bg-black/30 p-5 rounded-lg border-l-4 border-blue-600 backdrop-blur-sm">
                  <p className="text-gray-200 text-lg leading-relaxed font-light">"{plan.summary}"</p>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="relative pl-4">
              {/* Vertical Line */}
              <div className="absolute left-8 top-4 bottom-4 w-px bg-gradient-to-b from-transparent via-gray-800 to-transparent"></div>

              <div className="space-y-6">
                {plan.events.map((event, idx) => (
                  <TimelineEvent 
                    key={idx} 
                    event={event} 
                    onToggle={() => toggleEventCompletion(idx)}
                  />
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="fixed bottom-8 right-8 flex flex-col items-end gap-3 z-40">
               {synced && (
                 <div className="bg-green-600 text-white px-5 py-2.5 rounded-lg shadow-xl animate-bounce font-bold text-sm flex items-center gap-2">
                   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                   </svg>
                   Synced to Calendar
                 </div>
               )}
               <button 
                type="button"
                onClick={handleExportToCalendar}
                className="group bg-white hover:bg-gray-200 text-gray-900 px-8 py-4 rounded-full shadow-[0_0_30px_rgba(255,255,255,0.15)] font-bold flex items-center gap-3 transition-all hover:scale-105 active:scale-95"
              >
                <svg className="w-5 h-5 text-blue-600 group-hover:text-blue-700" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
                EXECUTE EXPORT
              </button>
            </div>

          </div>
        )}
      </main>

      <ContextEditor 
        isOpen={isEditorOpen}
        initialContext={context}
        onSave={setContext}
        onClose={() => setIsEditorOpen(false)}
      />

      <CredentialsModal
        isOpen={isCredsModalOpen}
        onClose={() => setIsCredsModalOpen(false)}
        onSave={(id) => initiateConnection(id)}
      />

    </div>
  );
};

export default App;