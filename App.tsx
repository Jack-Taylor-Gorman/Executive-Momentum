import React, { useState, useEffect } from 'react';
import { JACK_GORMAN_CONTEXT } from './constants';
import { generateDailySchedule } from './services/geminiService';
import { initGapiClient, requestAccessToken, listUpcomingEvents, exportScheduleToCalendar, preloadGoogleScripts } from './services/googleCalendarService';
import { DailyPlanResponse, ScheduleEvent } from './types';
import { TimelineEvent } from './components/TimelineEvent';
import { ContextEditor } from './components/ContextEditor';
import { CredentialsModal } from './components/CredentialsModal';

const App: React.FC = () => {
  const [context, setContext] = useState(JACK_GORMAN_CONTEXT);
  const [plan, setPlan] = useState<DailyPlanResponse | null>(null);
  const [loading, setLoading] = useState(false);
  
  // UI States
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isCredsModalOpen, setIsCredsModalOpen] = useState(false);
  const [synced, setSynced] = useState(false);
  
  // Connection states
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [scriptsLoaded, setScriptsLoaded] = useState(false);
  
  const [importedEvents, setImportedEvents] = useState<string>("");

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  // 1. Preload scripts on mount to ensure fast response when user clicks connect
  useEffect(() => {
    preloadGoogleScripts().then((loaded) => {
      setScriptsLoaded(loaded);
      if (loaded) {
        // If we have a stored ID, we can silently init the client so it's ready
        const storedId = localStorage.getItem('gcal_client_id');
        if (storedId) {
          initGapiClient(storedId).catch(err => console.error("Silent init failed", err));
        }
      }
    });
  }, []);

  const initiateConnection = async (clientId: string) => {
    setConnecting(true);
    try {
      localStorage.setItem('gcal_client_id', clientId);
      
      // Init client (should be fast if scripts preloaded)
      await initGapiClient(clientId);
      
      // Request permission (Popup happens here)
      await requestAccessToken();
      
      setCalendarConnected(true);
      
      // Fetch events
      const eventsStr = await listUpcomingEvents(tomorrow);
      setImportedEvents(eventsStr);
      
      const msg = eventsStr 
        ? "Connected! Found events for tomorrow:\n" + eventsStr 
        : "Connected! No events found for tomorrow.";
      alert(msg);
      
      setIsCredsModalOpen(false); // Close modal if open

    } catch (err: any) {
      console.error("Connection failed:", err);
      const msg = err.error || err.message || JSON.stringify(err);
      
      if (msg === "popup_closed_by_user") {
        alert("Login cancelled.");
      } else if (msg.includes("client_id") || msg.includes("origin")) {
        alert("Connection failed. Your Client ID might be invalid or not authorized for this origin.");
        localStorage.removeItem('gcal_client_id');
      } else {
        alert(`Failed to connect: ${msg}`);
      }
      setCalendarConnected(false);
    } finally {
      setConnecting(false);
    }
  };

  const handleConnectClick = () => {
    const storedId = localStorage.getItem('gcal_client_id');
    if (storedId) {
      // If we have an ID, try to connect immediately
      initiateConnection(storedId);
    } else {
      // Otherwise open the modal to get the ID
      setIsCredsModalOpen(true);
    }
  };

  const handleClearCredentials = () => {
    if(confirm("Disconnect Google Calendar and clear saved Client ID?")) {
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
               <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-green-400 flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                    G-Cal Linked
                  </span>
                  <button 
                    type="button"
                    onClick={handleClearCredentials} 
                    className="text-xs text-gray-500 hover:text-red-400 underline decoration-dotted"
                  >
                    (Disconnect)
                  </button>
               </div>
            ) : (
              <button
                type="button"
                onClick={handleConnectClick}
                disabled={connecting}
                className={`text-sm font-medium border border-gray-700 px-3 py-1.5 rounded hover:border-gray-500 transition-colors ${
                  connecting ? 'text-blue-400 cursor-wait' : 'text-gray-300 hover:text-white'
                }`}
              >
                {connecting ? 'Connecting...' : 'Connect Calendar'}
              </button>
            )}
            
             <button
              type="button"
              onClick={() => setIsEditorOpen(true)}
              className="text-sm font-medium text-gray-400 hover:text-white transition-colors"
            >
              Edit Context
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading}
              className={`px-4 py-2 rounded font-bold text-sm transition-all ${
                loading 
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                  : 'bg-white text-gray-900 hover:bg-gray-200 shadow-[0_0_15px_rgba(255,255,255,0.1)]'
              }`}
            >
              {loading ? 'Thinking...' : 'Generate Plan'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        
        {/* Empty State */}
        {!plan && !loading && (
          <div className="text-center py-20 opacity-50 animate-fade-in">
            <div className="text-6xl mb-4 grayscale">🗓️</div>
            <h2 className="text-2xl font-bold mb-2">Planning for {tomorrow.toLocaleDateString('en-US', { weekday: 'long' })}</h2>
            <p className="max-w-md mx-auto mb-6 text-gray-400">
              Your context is loaded. Connect your calendar to avoid conflicts, then click "Generate Plan" to architect your day.
            </p>
            {calendarConnected && importedEvents && (
               <div className="bg-gray-900 inline-block p-4 rounded text-left text-sm max-w-md border border-gray-800 shadow-lg">
                 <p className="text-gray-500 mb-2 text-xs uppercase font-bold tracking-wider">Synced Constraints</p>
                 <pre className="whitespace-pre-wrap font-mono text-xs text-green-400 overflow-x-auto">{importedEvents}</pre>
               </div>
            )}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="py-20 flex flex-col items-center justify-center space-y-4">
             <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
             <p className="text-blue-400 animate-pulse font-mono text-sm">Analyzing priorities & constraints...</p>
          </div>
        )}

        {/* Plan View */}
        {plan && !loading && (
          <div className="space-y-8 animate-fade-in">
            
            {/* Executive Summary Card */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 text-9xl font-black text-white pointer-events-none transition-transform group-hover:scale-110 duration-700">
                {plan.momentumScore}
              </div>
              
              <div className="relative z-10">
                <div className="flex justify-between items-end mb-4">
                  <div>
                    <h2 className="text-3xl font-bold text-white">{plan.dayOfWeek}</h2>
                    <p className="text-blue-400 font-mono text-sm">{plan.date}</p>
                  </div>
                  <div className="text-right">
                    <span className="block text-xs text-gray-500 uppercase">Momentum Score</span>
                    <span className={`text-2xl font-bold ${
                      plan.momentumScore > 80 ? 'text-green-400' : 'text-yellow-400'
                    }`}>{plan.momentumScore}/100</span>
                  </div>
                </div>
                
                <div className="bg-gray-800/50 p-4 rounded-lg border-l-2 border-blue-500">
                  <p className="text-gray-300 italic">"{plan.summary}"</p>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="relative">
              {/* Vertical Line */}
              <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-gray-800"></div>

              <div className="space-y-4">
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
            <div className="fixed bottom-8 right-8 flex flex-col items-end gap-2 z-40">
               {synced && (
                 <div className="bg-green-600 text-white px-4 py-2 rounded shadow-lg animate-bounce font-medium text-sm">
                   ✓ Synced to Google Calendar
                 </div>
               )}
               <button 
                type="button"
                onClick={handleExportToCalendar}
                className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-full shadow-2xl font-bold flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
                Export to G-Cal
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
        onSave={initiateConnection}
      />

    </div>
  );
};

export default App;