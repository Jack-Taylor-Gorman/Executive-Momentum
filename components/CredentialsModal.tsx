import React, { useState } from 'react';

interface Props {
  isOpen: boolean;
  onSave: (id: string) => void;
  onClose: () => void;
}

export const CredentialsModal: React.FC<Props> = ({ isOpen, onSave, onClose }) => {
  const [clientId, setClientId] = useState('');
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-lg w-full p-6 animate-scale-in">
        <h2 className="text-xl font-bold text-white mb-2">Connect Google Calendar</h2>
        <p className="text-sm text-gray-400 mb-6">
          To sync your schedule, we need a Google Cloud Client ID. This runs entirely in your browser.
        </p>
        
        <div className="space-y-6">
          {/* Input Section */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Client ID</label>
            <input
              type="text"
              className="w-full bg-gray-800 text-gray-100 p-3 rounded border border-gray-700 focus:border-blue-500 focus:outline-none text-sm font-mono"
              placeholder="123456789-abcdefg.apps.googleusercontent.com"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            />
          </div>
          
          {/* Configuration Help Section */}
          <div className="bg-gray-800/50 p-4 rounded border border-gray-700 space-y-3">
             <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h3 className="text-sm font-bold text-gray-200">Configuration Required</h3>
             </div>
             
             <p className="text-xs text-gray-400 leading-relaxed">
               If you get <span className="text-red-400 font-mono">Error 400: invalid_request</span>, you must add the URL below to 
               "Authorized JavaScript origins" in your Google Cloud Console.
             </p>

             <div className="relative">
                <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1">Current Origin (Add this to Google)</label>
                <div className="flex bg-black rounded border border-gray-600">
                  <code className="flex-1 p-2 text-xs text-green-400 font-mono overflow-x-auto whitespace-nowrap">
                    {origin}
                  </code>
                  <button 
                    onClick={() => navigator.clipboard.writeText(origin)}
                    className="px-3 border-l border-gray-600 hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
                    title="Copy to clipboard"
                  >
                    📋
                  </button>
                </div>
             </div>
             
             <p className="text-[10px] text-gray-500">
               Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="underline hover:text-blue-400">Google Cloud Console</a> &gt; Credentials &gt; Edit Client ID.
             </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white text-sm"
          >
            Cancel
          </button>
          <button 
            onClick={() => onSave(clientId.trim())}
            disabled={!clientId}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded text-sm transition-colors"
          >
            Save & Connect
          </button>
        </div>
      </div>
    </div>
  );
};