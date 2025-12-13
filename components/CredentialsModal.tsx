import React, { useState, useEffect } from 'react';

interface Props {
  isOpen: boolean;
  onSave: (id: string) => void;
  onClose: () => void;
}

const STABLE_PRODUCTION_URL = "https://executivemomentum.themirthco.com";

export const CredentialsModal: React.FC<Props> = ({ isOpen, onSave, onClose }) => {
  const [clientId, setClientId] = useState('');
  const [currentOrigin, setCurrentOrigin] = useState('');
  const [isDynamicUrl, setIsDynamicUrl] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentOrigin(window.location.origin);
      
      const isDynamic = window.location.hostname.includes('scf.usercontent.goog');
      setIsDynamicUrl(isDynamic);
      
      // Pre-fill if we have one stored
      const stored = localStorage.getItem('gcal_client_id');
      if (stored) setClientId(stored);
    }
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-lg w-full p-6 animate-scale-in">
        <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">System Configuration</h2>
              <p className="text-xs text-gray-500 mt-1">Link your Google Workspace account.</p>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1">✕</button>
        </div>
        
        <div className="space-y-6">
          
          {/* Production Check Warning */}
          {isDynamicUrl && (
            <div className="bg-orange-900/20 p-4 rounded border border-orange-500/30">
              <h3 className="text-orange-400 text-xs font-bold uppercase mb-2 flex items-center gap-2">
                ⚠️ Environment Warning
              </h3>
              <p className="text-gray-300 text-xs mb-3 leading-relaxed">
                You are on a temporary preview URL. Google Auth requires a stable domain.
              </p>
              <a 
                href={STABLE_PRODUCTION_URL}
                className="block text-center bg-gray-800 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded text-xs transition-colors border border-gray-600"
              >
                Go to Production App ({new URL(STABLE_PRODUCTION_URL).hostname})
              </a>
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Google Cloud Client ID
            </label>
            <input
              type="text"
              className="w-full bg-gray-950 text-gray-100 p-3 rounded border border-gray-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none text-sm font-mono placeholder-gray-700 transition-all"
              placeholder="e.g. 123456789-abc...apps.googleusercontent.com"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            />
            <p className="text-[10px] text-gray-500 leading-relaxed">
              This ID is stored locally in your browser. Ensure your Google Cloud Console allows requests from: <span className="text-gray-300 font-mono">{currentOrigin}</span>
            </p>
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3 border-t border-gray-800 pt-5">
           <button 
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={() => onSave(clientId.trim())}
            disabled={!clientId}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded text-sm transition-all shadow-lg hover:shadow-blue-500/20"
          >
            Save & Connect
          </button>
        </div>
      </div>
    </div>
  );
};