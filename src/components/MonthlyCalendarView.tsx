import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus, Clock, BookOpen, CheckCircle, Calendar as CalendarIcon } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameDay, isToday, isSameMonth, addMonths, subMonths } from "date-fns";
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
  source_provider?: string;
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
    return "bg-gradient-to-r from-red-100 to-red-200 border-l-4 border-l-red-400 text-red-700 shadow-sm";
  }
  
  if (lowerTitle.includes("write") || lowerTitle.includes("writing")) {
    return "bg-gradient-to-r from-amber-50 to-yellow-100 border-l-4 border-l-amber-400 text-amber-700 shadow-sm";
  }
  
  if (lowerTitle.includes("travel") || lowerTitle.includes("validation")) {
    return "bg-gradient-to-r from-cyan-50 to-cyan-100 border-l-4 border-l-cyan-400 text-cyan-700 shadow-sm";
  }
  
  if (lowerTitle.includes("book") || lowerTitle.includes("ticket")) {
    return "bg-gradient-to-r from-blue-100 to-blue-200 border-l-4 border-l-blue-500 text-blue-800 shadow-sm";
  }
  
  if (lowerTitle.includes("agency") || lowerTitle.includes("work") || lowerTitle.includes("weekly")) {
    return "bg-gradient-to-r from-indigo-50 to-indigo-100 border-l-4 border-l-indigo-400 text-indigo-700 shadow-sm";
  }
  
  if (lowerTitle.includes("lunch") || lowerTitle.includes("dinner") || lowerTitle.includes("food")) {
    return "bg-gradient-to-r from-orange-50 to-orange-100 border-l-4 border-l-orange-400 text-orange-700 shadow-sm";
  }
  
  if (lowerTitle.includes("learn") || lowerTitle.includes("class") || lowerTitle.includes("lesson")) {
    return "bg-gradient-to-r from-purple-50 to-purple-100 border-l-4 border-l-purple-400 text-purple-700 shadow-sm";
  }
  
  if (lowerTitle.includes("done")) {
    return "bg-gradient-to-r from-gray-50 to-gray-100 border-l-4 border-l-gray-400 text-gray-600 shadow-sm opacity-75";
  }
  
  return "bg-gradient-to-r from-slate-50 to-slate-100 border-l-4 border-l-slate-400 text-slate-700 shadow-sm";
};

const getTaskColorClass = (task: Task) => {
  if (task.completion_status === 'completed') {
    return "bg-gradient-to-r from-green-50 to-green-100 border-l-4 border-l-green-400 text-green-700 shadow-sm opacity-75";
  }
  
  const priority = task.priority_score || 0;
  if (priority >= 3) {
    return "bg-gradient-to-r from-red-50 to-red-100 border-l-4 border-l-red-400 text-red-700 shadow-sm";
  } else if (priority >= 2) {
    return "bg-gradient-to-r from-amber-50 to-amber-100 border-l-4 border-l-amber-400 text-amber-700 shadow-sm";
  }
  
  return "bg-gradient-to-r from-blue-50 to-blue-100 border-l-4 border-l-blue-400 text-blue-700 shadow-sm";
};

export const MonthlyCalendarView = ({ events, tasks, currentMonth, setCurrentMonth }: MonthlyCalendarViewProps) => {
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  
  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const handleToday = () => setCurrentMonth(new Date());

  const handleCellClick = (day: Date) => {
    setSelectedDate(day);
    setSelectedHour(null);
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
    setSelectedHour(null);
  };
  
  const getItemsForDay = (day: Date) => {
    const dayEvents = events.filter(event => {
      if (!event.start_time) return false;
      return isSameDay(new Date(event.start_time), day);
    });
    
    const dayTasks = tasks.filter(task => {
      if (!task.due_date) return false;
      return isSameDay(new Date(task.due_date), day);
    });
    
    return { events: dayEvents, tasks: dayTasks };
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex flex-col">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            {format(currentMonth, "MMMM yyyy")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Monthly Overview</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant={isSameMonth(currentMonth, new Date()) ? "default" : "outline"} size="sm" onClick={handleToday}>
            Current Month
          </Button>
          <Button variant="outline" size="sm" onClick={handleNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => {/* Add clear all functionality */}}>
            Clear All
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-card/50 backdrop-blur-sm border border-border/60 rounded-xl overflow-hidden shadow-lg">
        {/* Header Row - Days of Week */}
        <div className="grid grid-cols-7 bg-gradient-to-r from-muted/30 to-muted/50 backdrop-blur-sm">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div
              key={day}
              className="p-4 text-center border-r border-border/40 last:border-r-0 bg-muted/20"
            >
              <div className="text-sm font-semibold text-muted-foreground">
                {day}
              </div>
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, index) => {
            const { events: dayEvents, tasks: dayTasks } = getItemsForDay(day);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const hasItems = dayEvents.length > 0 || dayTasks.length > 0;
            
            return (
              <div
                key={day.toISOString()}
                className={`min-h-[140px] border-r border-b border-border/30 last:border-r-0 p-2 transition-all duration-200 relative group/day ${
                  isToday(day) 
                    ? "bg-gradient-to-br from-primary/5 to-primary/10 ring-1 ring-primary/20" 
                    : isCurrentMonth
                      ? "hover:bg-accent/20 hover:shadow-sm cursor-pointer"
                      : "bg-muted/20 text-muted-foreground"
                }`}
                onClick={() => isCurrentMonth && handleCellClick(day)}
              >
                {/* Date Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className={`text-sm font-semibold px-2 py-1 rounded-md ${
                    isToday(day)
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : isCurrentMonth
                        ? "text-foreground"
                        : "text-muted-foreground"
                  }`}>
                    {format(day, 'd')}
                  </div>
                  
                  {/* Add button for current month days */}
                  {isCurrentMonth && !hasItems && (
                    <div className="opacity-0 group-hover/day:opacity-60 transition-all duration-200">
                      <Plus className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Events and Tasks */}
                {isCurrentMonth && (
                  <div className={`space-y-1 max-h-[80px] overflow-y-scroll pr-1 ${
                    (dayEvents.length + dayTasks.length) > 1 ? 'force-scrollbar-always' : 'custom-scrollbar'
                  }`}>{/* Show scrollbar when multiple items */}
                    {/* Events */}
                    {dayEvents.map((event, eventIndex) => (
                      <div
                        key={event.id}
                        className={`p-1.5 rounded-md cursor-pointer hover:scale-[1.02] transition-all duration-200 text-xs ${getEventColorClass(event.title)} animate-fade-in`}
                        style={{ animationDelay: `${eventIndex * 50}ms` }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEventClick(event);
                        }}
                      >
                        <div className="font-semibold leading-tight truncate flex items-center gap-1">
                          <Clock className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{event.title}</span>
                        </div>
                        <div className="text-xs opacity-80 truncate">
                          {event.start_time ? (() => {
                            // Check if this is a Canvas 23:59:59+00:00 time BEFORE parsing the date
                            if (event.source_provider === 'canvas' && event.start_time.includes('23:59:59+00')) {
                              return "11:59 PM";
                            }
                            const date = new Date(event.start_time);
                            return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                          })() : 'All day'}
                        </div>
                      </div>
                    ))}
                    
                    {/* Tasks */}
                    {dayTasks.map((task, taskIndex) => (
                      <div
                        key={task.id}
                        className={`p-1.5 rounded-md cursor-pointer hover:scale-[1.02] transition-all duration-200 text-xs ${getTaskColorClass(task)} animate-fade-in`}
                        style={{ animationDelay: `${(dayEvents.length + taskIndex) * 50}ms` }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTaskClick(task);
                        }}
                      >
                        <div className="font-semibold leading-tight truncate flex items-center gap-1">
                          {task.completion_status === 'completed' ? 
                            <CheckCircle className="h-3 w-3 flex-shrink-0" /> : 
                            <BookOpen className="h-3 w-3 flex-shrink-0" />
                          }
                          <span className="truncate">{task.title}</span>
                        </div>
                        <div className="text-xs opacity-80 truncate">
                          Due: {task.due_date ? (() => {
                            // Check if this is a Canvas 23:59:59+00:00 time BEFORE parsing the date
                            if (task.source_provider === 'canvas' && task.due_date.includes('23:59:59+00')) {
                              return "11:59 PM";
                            }
                            const date = new Date(task.due_date);
                            return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                          })() : 'Today'}
                        </div>
                      </div>
                    ))}
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
        selectedHour={selectedHour || undefined}
      />
    </div>
  );
};