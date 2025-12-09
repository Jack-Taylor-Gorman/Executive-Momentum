import React from 'react';
import { ScheduleEvent, EventType } from '../types';

interface Props {
  event: ScheduleEvent;
  onToggle: () => void;
}

const getEventStyles = (type: EventType, completed: boolean) => {
  const base = "transition-all duration-300";
  
  if (completed) {
    return `${base} border-l-4 border-gray-700 bg-gray-900/50 text-gray-600 grayscale`;
  }

  switch (type) {
    case EventType.FIXED:
      return `${base} border-l-4 border-blue-500 bg-blue-900/20 text-blue-100`;
    case EventType.CRITICAL:
      return `${base} border-l-4 border-red-500 bg-red-900/20 text-red-100`; 
    case EventType.HIGH:
      return `${base} border-l-4 border-yellow-500 bg-yellow-900/20 text-yellow-100`;
    case EventType.LEISURE:
      return `${base} border-l-4 border-green-500 bg-green-900/20 text-green-100`;
    default:
      return `${base} border-l-4 border-gray-500 bg-gray-800 text-gray-300`;
  }
};

export const TimelineEvent: React.FC<Props> = ({ event, onToggle }) => {
  const styles = getEventStyles(event.type, !!event.completed);

  return (
    <div 
      className={`group mb-3 p-4 rounded-r-lg shadow-sm ${styles} relative hover:pl-5 cursor-pointer select-none`}
      onClick={onToggle}
    >
      <div className="flex justify-between items-start gap-4">
        {/* Checkbox Visual */}
        <div className={`mt-1 flex-shrink-0 w-6 h-6 rounded border flex items-center justify-center transition-colors ${
          event.completed 
            ? 'bg-blue-600 border-blue-600' 
            : 'border-gray-500 group-hover:border-blue-400'
        }`}>
          {event.completed && (
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>

        <div className={`flex-grow ${event.completed ? 'line-through opacity-50' : ''}`}>
          <div className="flex items-baseline gap-2 mb-1">
             <span className="text-xs font-mono opacity-70">
              {event.startTime} - {event.endTime}
            </span>
            <span className="text-xs font-mono opacity-50">
               ({event.durationMinutes}m)
            </span>
          </div>
         
          <h3 className="font-bold text-lg leading-tight">{event.title}</h3>
          <p className="text-sm opacity-80 mt-1 whitespace-pre-wrap">{event.description}</p>
        </div>
        
        <div className="text-xs uppercase tracking-wider font-semibold opacity-60">
          {event.type}
        </div>
      </div>
    </div>
  );
};
