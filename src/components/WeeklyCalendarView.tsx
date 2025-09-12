import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, isSameDay, isToday, getHours } from "date-fns";

interface Event {
  id: string;
  title: string;
  start_time: string;
  end_time?: string;
  event_type: string;
  source_provider?: string;
}

interface Task {
  id: string;
  title: string;
  due_date?: string;
  priority_score?: number;
  completion_status?: string;
  course_name?: string;
}

interface WeeklyCalendarViewProps {
  events: Event[];
  tasks: Task[];
  storedColors?: Record<string, string>;
  currentWeek: Date;
  setCurrentWeek: (date: Date) => void;
}

const TIME_SLOTS = [
  { label: "8am", hour: 8 },
  { label: "9am", hour: 9 },
  { label: "10am", hour: 10 },
  { label: "11am", hour: 11 },
  { label: "12pm", hour: 12 },
  { label: "1pm", hour: 13 },
  { label: "2pm", hour: 14 },
  { label: "3pm", hour: 15 },
  { label: "4pm", hour: 16 },
  { label: "5pm", hour: 17 },
  { label: "6pm", hour: 18 },
  { label: "7pm", hour: 19 },
  { label: "8pm", hour: 20 },
  { label: "9pm", hour: 21 },
  { label: "10pm", hour: 22 },
  { label: "11pm", hour: 23 }
];

const getEventColorClass = (title: string) => {
  const lowerTitle = title.toLowerCase();
  
  if (lowerTitle.includes("fitness") || lowerTitle.includes("workout")) {
    return "bg-red-200 border-red-300 text-red-800";
  }
  
  if (lowerTitle.includes("write") || lowerTitle.includes("writing")) {
    return "bg-yellow-200 border-yellow-300 text-yellow-800";
  }
  
  if (lowerTitle.includes("travel") || lowerTitle.includes("validation")) {
    return "bg-cyan-200 border-cyan-300 text-cyan-800";
  }
  
  if (lowerTitle.includes("book") || lowerTitle.includes("ticket")) {
    return "bg-blue-400 border-blue-500 text-white";
  }
  
  if (lowerTitle.includes("agency") || lowerTitle.includes("work") || lowerTitle.includes("weekly")) {
    return "bg-blue-200 border-blue-300 text-blue-800";
  }
  
  if (lowerTitle.includes("lunch") || lowerTitle.includes("dinner") || lowerTitle.includes("food")) {
    return "bg-orange-200 border-orange-300 text-orange-800";
  }
  
  if (lowerTitle.includes("learn") || lowerTitle.includes("class") || lowerTitle.includes("lesson")) {
    return "bg-purple-200 border-purple-300 text-purple-800";
  }
  
  if (lowerTitle.includes("done")) {
    return "bg-gray-200 border-gray-300 text-gray-700";
  }
  
  return "bg-gray-200 border-gray-300 text-gray-800";
};

export const WeeklyCalendarView = ({ events, tasks, currentWeek, setCurrentWeek }: WeeklyCalendarViewProps) => {
  const [expandedCell, setExpandedCell] = useState<string | null>(null);
  console.log('WeeklyCalendarView rendered, expandedCell:', expandedCell);
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 0 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const handleCellClick = (day: Date, hour: number) => {
    const cellKey = `${day.toISOString()}-${hour}`;
    console.log('Cell clicked!', { cellKey, expandedCell });
    setExpandedCell(expandedCell === cellKey ? null : cellKey);
    console.log('Setting expanded cell to:', expandedCell === cellKey ? null : cellKey);
  };
  
  const getItemsForTimeSlot = (day: Date, hour: number) => {
    const dayEvents = events.filter(event => {
      if (!event.start_time) return false;
      const eventDate = new Date(event.start_time);
      const eventHour = eventDate.getHours();
      return isSameDay(eventDate, day) && eventHour === hour;
    });
    
    const dayTasks = tasks.filter(task => {
      if (!task.due_date) return false;
      const taskDate = new Date(task.due_date);
      const taskHour = taskDate.getHours();
      return isSameDay(taskDate, day) && taskHour === hour;
    });
    
    return { events: dayEvents, tasks: dayTasks };
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">
          Week of {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
        </h2>
      </div>

      {/* Calendar Grid */}
      <div className="border border-gray-300 rounded-lg overflow-hidden bg-white">
        {/* Header Row */}
        <div className="grid grid-cols-8 bg-gray-50">
          <div className="p-2 text-xs text-gray-600 border-r border-gray-300 bg-gray-100">
            GMT+08
          </div>
          {weekDays.map((day) => (
            <div
              key={day.toISOString()}
              className={`p-2 text-center border-r border-gray-300 last:border-r-0 ${
                isToday(day) ? "bg-blue-100 text-blue-800 font-semibold" : "bg-gray-50"
              }`}
            >
              <div className="text-sm font-medium">
                {format(day, "EEE")} {format(day, "M/d")}
              </div>
            </div>
          ))}
        </div>

        {/* Time Slots */}
        {TIME_SLOTS.map((timeSlot) => (
          <div key={timeSlot.hour} className="grid grid-cols-8">
            {/* Time Label */}
            <div className="p-2 text-xs text-gray-600 border-r border-b border-gray-300 bg-gray-50 text-right font-medium">
              {timeSlot.label}
            </div>
            
            {/* Day Cells */}
            {weekDays.map((day) => {
              const { events: slotEvents, tasks: slotTasks } = getItemsForTimeSlot(day, timeSlot.hour);
              const cellKey = `${day.toISOString()}-${timeSlot.hour}`;
              const isExpanded = expandedCell === cellKey;
              
              return (
                <div
                  key={cellKey}
                  className={`${isExpanded ? 'min-h-[200px]' : 'min-h-[50px]'} border-r border-b border-gray-300 last:border-r-0 p-1 space-y-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-300 relative group ${isExpanded ? 'bg-blue-50 dark:bg-blue-900/20 shadow-lg z-10' : ''}`}
                  onClick={() => handleCellClick(day, timeSlot.hour)}
                  title={`${format(day, 'MMM d')} at ${timeSlot.label} - Click to ${isExpanded ? 'collapse' : 'expand'} details`}
                >
                  {/* Expanded cell header */}
                  {isExpanded && (
                    <div className="mb-2 p-2 bg-white dark:bg-gray-800 rounded border">
                      <h3 className="font-semibold text-sm text-gray-800 dark:text-gray-200">
                        {format(day, 'EEEE, MMMM d')} at {timeSlot.label}
                      </h3>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {slotEvents.length + slotTasks.length === 0 
                          ? 'No events or tasks scheduled' 
                          : `${slotEvents.length} events, ${slotTasks.length} tasks`}
                      </p>
                    </div>
                  )}

                  {/* Add icon for empty cells */}
                  {!isExpanded && slotEvents.length === 0 && slotTasks.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-30 transition-opacity pointer-events-none">
                      <div className="text-gray-400 text-xs">+</div>
                    </div>
                  )}
                  
                  {/* Events */}
                  {slotEvents.map((event) => (
                    <div
                      key={event.id}
                      className={`p-1 rounded text-xs border cursor-pointer hover:opacity-80 relative z-10 ${getEventColorClass(event.title)}`}
                      title={event.title}
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log('Clicked event:', event);
                      }}
                    >
                      <div className="font-medium leading-tight">{event.title}</div>
                      {isExpanded ? (
                        <div className="space-y-1 mt-1">
                          <div className="text-xs opacity-80">
                            Time: {event.start_time ? (() => {
                              const date = new Date(event.start_time);
                              if (event.source_provider === 'canvas' && event.start_time.includes('23:59:59+00')) {
                                const fixedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
                                return fixedDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                              }
                              return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                            })() : 'No time'}
                          </div>
                          {event.event_type && (
                            <div className="text-xs opacity-70">Type: {event.event_type}</div>
                          )}
                          {event.source_provider && (
                            <div className="text-xs opacity-70">Source: {event.source_provider}</div>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs opacity-80">
                          {event.start_time ? (() => {
                            const date = new Date(event.start_time);
                            if (event.source_provider === 'canvas' && event.start_time.includes('23:59:59+00')) {
                              const fixedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
                              return fixedDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                            }
                            return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                          })() : 'No time'}
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {/* Tasks */}
                  {slotTasks.map((task) => (
                    <div
                      key={task.id}
                      className="p-1 rounded text-xs bg-yellow-200 border border-yellow-300 text-yellow-800 cursor-pointer hover:opacity-80 relative z-10"
                      title={task.title}
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log('Clicked task:', task);
                      }}
                    >
                      <div className="font-medium leading-tight">{task.title}</div>
                      {isExpanded ? (
                        <div className="space-y-1 mt-1">
                          <div className="text-xs opacity-70">
                            Due: {task.due_date ? new Date(task.due_date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : 'No time'}
                          </div>
                          {task.priority_score !== undefined && (
                            <div className="text-xs opacity-70">Priority: {task.priority_score}</div>
                          )}
                          {task.completion_status && (
                            <div className="text-xs opacity-70">Status: {task.completion_status}</div>
                          )}
                          {task.course_name && (
                            <div className="text-xs opacity-70">Course: {task.course_name}</div>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs opacity-70">
                          Due: {task.due_date ? new Date(task.due_date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : 'No time'}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};