import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Cloud, Sun, CloudRain, Snowflake, Thermometer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isToday, startOfWeek, endOfWeek, isSameMonth } from "date-fns";
import { useAuth } from "@/hooks/useAuth";

interface Task {
  id: string;
  title: string;
  due_date: string;
  priority_score: number;
  completion_status: string;
  course_name: string;
}

interface Event {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  event_type: string;
}

interface StudySession {
  id: string;
  title: string;
  start_time: string;
  session_type: string;
}

interface WeatherData {
  temperature: number;
  condition: string;
  icon: string;
}

const Calendar = () => {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [studySessions, setStudySessions] = useState<StudySession[]>([]);
  const [weather, setWeather] = useState<{ [key: string]: WeatherData }>({});
  const [loading, setLoading] = useState(true);

  // Calculate proper calendar grid (6 weeks)
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, currentDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch tasks
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user?.id)
        .gte('due_date', calendarStart.toISOString())
        .lte('due_date', calendarEnd.toISOString());

      // Fetch events
      const { data: eventsData } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', user?.id)
        .gte('start_time', calendarStart.toISOString())
        .lte('start_time', calendarEnd.toISOString());

      // Fetch study sessions
      const { data: sessionsData } = await supabase
        .from('study_sessions')
        .select('*')
        .eq('user_id', user?.id)
        .gte('start_time', calendarStart.toISOString())
        .lte('start_time', calendarEnd.toISOString());

      setTasks(tasksData || []);
      setEvents(eventsData || []);
      setStudySessions(sessionsData || []);

      // Fetch weather data for each day
      await fetchWeatherData();
    } catch (error) {
      console.error('Error fetching calendar data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWeatherData = async () => {
    // Mock weather data for now - in production, integrate with weather API
    const mockWeather: { [key: string]: WeatherData } = {};
    calendarDays.forEach((day, index) => {
      const dateKey = format(day, 'yyyy-MM-dd');
      const conditions = ['sunny', 'cloudy', 'rainy', 'snowy'];
      const temps = [65, 72, 68, 58, 75, 70, 63];
      mockWeather[dateKey] = {
        temperature: temps[index % temps.length],
        condition: conditions[index % conditions.length],
        icon: conditions[index % conditions.length]
      };
    });
    setWeather(mockWeather);
  };

  const getWeatherIcon = (condition: string) => {
    switch (condition) {
      case 'sunny': return <Sun className="h-4 w-4 text-yellow-500" />;
      case 'cloudy': return <Cloud className="h-4 w-4 text-gray-500" />;
      case 'rainy': return <CloudRain className="h-4 w-4 text-blue-500" />;
      case 'snowy': return <Snowflake className="h-4 w-4 text-blue-200" />;
      default: return <Sun className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getPriorityColor = (priority: number) => {
    if (priority >= 8) return "bg-red-500";
    if (priority >= 6) return "bg-orange-500";
    if (priority >= 4) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getTasksForDay = (day: Date) => {
    return tasks.filter(task => 
      task.due_date && isSameDay(new Date(task.due_date), day)
    );
  };

  const getEventsForDay = (day: Date) => {
    return events.filter(event => 
      isSameDay(new Date(event.start_time), day)
    );
  };

  const getSessionsForDay = (day: Date) => {
    return studySessions.filter(session => 
      isSameDay(new Date(session.start_time), day)
    );
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => 
      direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1)
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">Loading Calendar...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-foreground">
          {format(currentDate, 'MMMM yyyy')}
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigateMonth('prev')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigateMonth('next')}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 mb-4">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center font-semibold text-muted-foreground p-2">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {calendarDays.map((day, index) => {
          const dayTasks = getTasksForDay(day);
          const dayEvents = getEventsForDay(day);
          const daySessions = getSessionsForDay(day);
          const dayWeather = weather[format(day, 'yyyy-MM-dd')];
          const highestPriority = Math.max(...dayTasks.map(t => t.priority_score || 0), 0);
          const isCurrentMonth = isSameMonth(day, currentDate);

          return (
            <Card key={index} className={`min-h-[120px] p-2 transition-all duration-200 ${
              isToday(day) 
                ? 'ring-2 ring-primary bg-primary/5' 
                : isCurrentMonth 
                  ? 'bg-card hover:bg-accent/50' 
                  : 'bg-muted/30'
            }`}>
              <CardContent className="p-0 space-y-1">
                {/* Date and Weather */}
                <div className="flex items-center justify-between text-sm">
                  <span className={`font-semibold ${
                    isToday(day) 
                      ? 'text-primary text-lg' 
                      : isCurrentMonth 
                        ? 'text-foreground' 
                        : 'text-muted-foreground'
                  }`}>
                    {format(day, 'd')}
                  </span>
                  {dayWeather && isCurrentMonth && (
                    <div className="flex items-center gap-1">
                      {getWeatherIcon(dayWeather.condition)}
                      <span className="text-xs text-muted-foreground">
                        {dayWeather.temperature}°
                      </span>
                    </div>
                  )}
                </div>

                {/* Priority Indicator */}
                {highestPriority > 0 && isCurrentMonth && (
                  <div className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${getPriorityColor(highestPriority)}`} />
                    <span className="text-xs text-muted-foreground">P{Math.round(highestPriority)}</span>
                  </div>
                )}

                {/* Only show content for current month days */}
                {isCurrentMonth && (
                  <>
                    {/* Tasks */}
                    {dayTasks.slice(0, 2).map(task => (
                      <Badge key={task.id} variant="secondary" className="text-xs w-full justify-start truncate">
                        📝 {task.title}
                      </Badge>
                    ))}

                    {/* Events */}
                    {dayEvents.slice(0, 1).map(event => (
                      <Badge key={event.id} variant="outline" className="text-xs w-full justify-start truncate">
                        📅 {event.title}
                      </Badge>
                    ))}

                    {/* Study Sessions */}
                    {daySessions.slice(0, 1).map(session => (
                      <Badge key={session.id} variant="default" className="text-xs w-full justify-start truncate">
                        📚 {session.title}
                      </Badge>
                    ))}

                    {/* Overflow indicator */}
                    {(dayTasks.length + dayEvents.length + daySessions.length) > 4 && (
                      <div className="text-xs text-muted-foreground text-center">
                        +{(dayTasks.length + dayEvents.length + daySessions.length) - 4} more
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 flex flex-wrap gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>📝 Tasks</span>
          <span>📅 Events</span>
          <span>📚 Study Sessions</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span>High Priority</span>
          <div className="w-3 h-3 rounded-full bg-orange-500" />
          <span>Medium Priority</span>
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span>Low Priority</span>
        </div>
      </div>
    </div>
  );
};

export default Calendar;