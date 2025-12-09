import React, { useState } from 'react';

interface Props {
  initialContext: string;
  onSave: (newContext: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const ContextEditor: React.FC<Props> = ({ initialContext, onSave, isOpen, onClose }) => {
  const [text, setText] = useState(initialContext);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/50 backdrop-blur-sm">
      <div className="w-full md:w-1/2 h-full bg-gray-900 shadow-2xl border-l border-gray-700 flex flex-col p-6 animate-slide-in">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Executive Context</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        <p className="text-sm text-gray-400 mb-4">
          Edit your profile, priorities, constraints, and fixed schedules here. The AI uses this raw data to generate your timeline.
        </p>
        <textarea
          className="flex-1 bg-gray-800 text-gray-100 p-4 rounded-md font-mono text-sm border border-gray-700 focus:border-blue-500 focus:outline-none resize-none"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="mt-4 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-gray-300 hover:text-white"
          >
            Cancel
          </button>
          <button 
            onClick={() => {
              onSave(text);
              onClose();
            }}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded"
          >
            Save & Update
          </button>
        </div>
      </div>
    </div>
  );
};
