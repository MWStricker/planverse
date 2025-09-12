import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameDay, isToday, startOfWeek, endOfWeek } from "date-fns";
import { EventTaskModal } from "./EventTaskModal";

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

interface MonthlyCalendarViewProps {
  events: Event[];
  tasks: Task[];
  storedColors?: Record<string, string>;
  currentMonth: Date;
  setCurrentMonth: (date: Date) => void;
}

const getEventColorClass = (title: string) => {
  const lowerTitle = title.toLowerCase();
  
  if (lowerTitle.includes("fitness") || lowerTitle.includes("workout")) {
    return "bg-gradient-to-br from-red-100 to-red-200 border-l-4 border-l-red-400 text-red-700 shadow-sm";
  }
  
  if (lowerTitle.includes("write") || lowerTitle.includes("writing")) {
    return "bg-gradient-to-br from-amber-50 to-yellow-100 border-l-4 border-l-amber-400 text-amber-700 shadow-sm";
  }
  
  if (lowerTitle.includes("travel") || lowerTitle.includes("validation")) {
    return "bg-gradient-to-br from-cyan-50 to-cyan-100 border-l-4 border-l-cyan-400 text-cyan-700 shadow-sm";
  }
  
  if (lowerTitle.includes("book") || lowerTitle.includes("ticket")) {
    return "bg-gradient-to-br from-blue-100 to-blue-200 border-l-4 border-l-blue-500 text-blue-800 shadow-sm";
  }
  
  if (lowerTitle.includes("agency") || lowerTitle.includes("work") || lowerTitle.includes("weekly")) {
    return "bg-gradient-to-br from-indigo-50 to-indigo-100 border-l-4 border-l-indigo-400 text-indigo-700 shadow-sm";
  }
  
  if (lowerTitle.includes("lunch") || lowerTitle.includes("dinner") || lowerTitle.includes("food")) {
    return "bg-gradient-to-br from-orange-50 to-orange-100 border-l-4 border-l-orange-400 text-orange-700 shadow-sm";
  }
  
  if (lowerTitle.includes("learn") || lowerTitle.includes("class") || lowerTitle.includes("lesson")) {
    return "bg-gradient-to-br from-purple-50 to-purple-100 border-l-4 border-l-purple-400 text-purple-700 shadow-sm";
  }
  
  if (lowerTitle.includes("done")) {
    return "bg-gradient-to-br from-gray-50 to-gray-100 border-l-4 border-l-gray-400 text-gray-600 shadow-sm opacity-75";
  }
  
  return "bg-gradient-to-br from-slate-50 to-slate-100 border-l-4 border-l-slate-400 text-slate-700 shadow-sm";
};

export const MonthlyCalendarView = ({ events, tasks, currentMonth, setCurrentMonth }: MonthlyCalendarViewProps) => {
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const handleCellClick = (day: Date) => {
    setSelectedDate(day);
    setSelectedEvent(null);
    setSelectedTask(null);
    setIsModalOpen(true);
  };

  const handleEventClick = (event: Event) => {
    setSelectedEvent(event);
    setSelectedTask(null);
    setIsModalOpen(true);
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setSelectedEvent(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedEvent(null);
    setSelectedTask(null);
    setSelectedDate(null);
  };
  
  const getItemsForDay = (day: Date) => {
    const dayEvents = events.filter(event => {
      if (!event.start_time) return false;
      const eventDate = new Date(event.start_time);
      return isSameDay(eventDate, day);
    });
    
    const dayTasks = tasks.filter(task => {
      if (!task.due_date) return false;
      const taskDate = new Date(task.due_date);
      return isSameDay(taskDate, day);
    });
    
    return { events: dayEvents, tasks: dayTasks };
  };

  const isCurrentMonth = (day: Date) => {
    return day.getMonth() === currentMonth.getMonth();
  };

  const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex flex-col">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            {format(currentMonth, "MMMM yyyy")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Monthly Schedule</p>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-card/50 backdrop-blur-sm border border-border/60 rounded-xl overflow-hidden shadow-lg">
        {/* Header Row - Days of Week */}
        <div className="grid grid-cols-7 bg-gradient-to-r from-muted/30 to-muted/50 backdrop-blur-sm">
          {weekDays.map((day, index) => (
            <div
              key={day}
              className="p-3 text-center border-r border-border/40 last:border-r-0 relative overflow-hidden bg-muted/20"
            >
              {index === 0 && (
                <div className="absolute left-0 top-0 bottom-0 w-px bg-primary/20"></div>
              )}
              <div className="text-sm font-semibold relative z-10 text-muted-foreground">
                {day}
              </div>
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, index) => {
            const { events: dayEvents, tasks: dayTasks } = getItemsForDay(day);
            const isCurrentMonthDay = isCurrentMonth(day);
            const isTodayDay = isToday(day);
            const rowIndex = Math.floor(index / 7);
            const colIndex = index % 7;
            
            return (
              <div
                key={day.toISOString()}
                className={`min-h-[120px] border-r border-b border-border/30 last:border-r-0 p-2 space-y-1.5 cursor-pointer transition-all duration-300 relative group/cell ${
                  isTodayDay 
                    ? "bg-gradient-to-br from-primary/5 to-primary/10 ring-1 ring-primary/20" 
                    : "hover:bg-accent/20 hover:shadow-sm"
                } ${!isCurrentMonthDay ? "bg-muted/20 text-muted-foreground" : ""} ${
                  rowIndex % 2 === 0 ? "border-t-border/50" : ""
                }`}
                onClick={() => handleCellClick(day)}
                title={`${format(day, 'MMM d, yyyy')} - Click to add event`}
              >
                {/* Current day indicator */}
                {isTodayDay && (
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary shadow-sm shadow-primary/50"></div>
                )}
                
                {/* Weekly indicator lines */}
                {colIndex === 0 && (
                  <div className="absolute left-0 top-0 bottom-0 w-px bg-primary/20"></div>
                )}
                
                {/* Date Number */}
                <div className="flex items-center justify-between mb-2">
                  <div className={`text-lg font-bold relative z-10 ${
                    isTodayDay 
                      ? "text-primary" 
                      : isCurrentMonthDay 
                        ? "text-foreground" 
                        : "text-muted-foreground"
                  }`}>
                    {format(day, "d")}
                  </div>
                  {/* Today indicator badge */}
                  {isTodayDay && (
                    <div className="w-2 h-2 rounded-full bg-primary/50"></div>
                  )}
                </div>
                
                {/* Add icon for empty cells */}
                {dayEvents.length === 0 && dayTasks.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/cell:opacity-50 transition-all duration-200 pointer-events-none">
                    <div className="w-6 h-6 rounded-full bg-muted/40 flex items-center justify-center">
                      <div className="text-muted-foreground text-sm font-medium">+</div>
                    </div>
                  </div>
                )}
                
                {/* Events */}
                {dayEvents.slice(0, 2).map((event, eventIndex) => (
                  <div
                    key={event.id}
                    className={`p-2 rounded-lg text-xs cursor-pointer hover:scale-[1.02] transition-all duration-200 relative z-10 ${getEventColorClass(event.title)} animate-fade-in`}
                    style={{ animationDelay: `${eventIndex * 50}ms` }}
                    title={`Click to view event: ${event.title}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEventClick(event);
                    }}
                  >
                    <div className="font-semibold leading-tight truncate mb-1">{event.title}</div>
                    <div className="text-xs opacity-80 truncate flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-current opacity-60"></span>
                      {event.start_time ? (() => {
                        const date = new Date(event.start_time);
                        if (event.source_provider === 'canvas' && event.start_time.includes('23:59:59+00')) {
                          const fixedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
                          return fixedDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                        }
                        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                      })() : 'All day'}
                    </div>
                  </div>
                ))}
                
                {/* Tasks */}
                {dayTasks.slice(0, 2 - dayEvents.slice(0, 2).length).map((task, taskIndex) => (
                  <div
                    key={task.id}
                    className="p-2 rounded-lg text-xs bg-gradient-to-br from-amber-50 to-yellow-100 border-l-4 border-l-amber-400 text-amber-700 shadow-sm cursor-pointer hover:scale-[1.02] transition-all duration-200 relative z-10 animate-fade-in"
                    style={{ animationDelay: `${(dayEvents.slice(0, 2).length + taskIndex) * 50}ms` }}
                    title={`Click to view task: ${task.title}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTaskClick(task);
                    }}
                  >
                    <div className="font-semibold leading-tight truncate mb-1 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                      {task.title}
                    </div>
                    <div className="text-xs opacity-70 truncate">
                      Due: {task.due_date ? new Date(task.due_date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : 'Today'}
                    </div>
                  </div>
                ))}
                
                {/* Show more indicator */}
                {(dayEvents.length + dayTasks.length) > 2 && (
                  <div className="text-xs text-muted-foreground pl-1 flex items-center gap-1 mt-1">
                    <span className="w-1 h-1 rounded-full bg-current opacity-40"></span>
                    +{(dayEvents.length + dayTasks.length) - 2} more
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Event/Task Modal */}
      <EventTaskModal
        isOpen={isModalOpen}
        onClose={closeModal}
        event={selectedEvent || undefined}
        task={selectedTask || undefined}
        selectedDate={selectedDate || undefined}
      />
    </div>
  );
};