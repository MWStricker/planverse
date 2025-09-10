import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Cloud, Sun, CloudRain, Snowflake, Thermometer, AlertTriangle, Clock, BookOpen, CheckCircle } from "lucide-react";
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
  temp: number;
  maxTemp?: number;
  minTemp?: number;
  description: string;
  icon: string;
  humidity: number;
  windSpeed: number;
  location?: string;
}

const Calendar = () => {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [studySessions, setStudySessions] = useState<StudySession[]>([]);
  const [weather, setWeather] = useState<{ current?: WeatherData; forecast: { [key: string]: WeatherData } }>(() => {
    // Load cached weather data from localStorage on component mount
    try {
      const cached = localStorage.getItem('weather-data');
      if (cached) {
        const parsedData = JSON.parse(cached);
        // Check if data is less than 30 minutes old
        if (parsedData.timestamp && Date.now() - parsedData.timestamp < 30 * 60 * 1000) {
          return { current: parsedData.current, forecast: parsedData.forecast };
        }
      }
    } catch (error) {
      console.error('Error loading cached weather data:', error);
    }
    return { forecast: {} };
  });
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(() => {
    // Load cached location from localStorage
    try {
      const cached = localStorage.getItem('user-location');
      if (cached) {
        const parsedLocation = JSON.parse(cached);
        // Use cached location if it's less than 1 hour old
        if (parsedLocation.timestamp && Date.now() - parsedLocation.timestamp < 60 * 60 * 1000) {
          return { lat: parsedLocation.lat, lon: parsedLocation.lon };
        }
      }
    } catch (error) {
      console.error('Error loading cached location:', error);
    }
    return null;
  });
  const [loading, setLoading] = useState(true);

  // Calculate proper calendar grid (6 weeks)
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  useEffect(() => {
    // Get user's location with caching and shorter timeout for faster loading
    if (!userLocation && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lon: position.coords.longitude
          };
          setUserLocation(location);
          
          // Cache location with timestamp
          try {
            localStorage.setItem('user-location', JSON.stringify({
              ...location,
              timestamp: Date.now()
            }));
          } catch (error) {
            console.error('Error caching location:', error);
          }
        },
        (error) => {
          console.error('Error getting location:', error);
          // Faster fallback to default location (New York)
          const defaultLocation = { lat: 40.7128, lon: -74.0060 };
          setUserLocation(defaultLocation);
          
          // Cache default location
          try {
            localStorage.setItem('user-location', JSON.stringify({
              ...defaultLocation,
              timestamp: Date.now()
            }));
          } catch (error) {
            console.error('Error caching default location:', error);
          }
        },
        {
          enableHighAccuracy: false, // Faster, less accurate location
          timeout: 5000, // Reduced timeout
          maximumAge: 600000 // Cache location for 10 minutes
        }
      );
    } else if (!userLocation) {
      // If geolocation is not available, use default location
      const defaultLocation = { lat: 40.7128, lon: -74.0060 };
      setUserLocation(defaultLocation);
    }
  }, [userLocation]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, currentDate]);

  // Ensure weather loads once geolocation resolves (even after initial render)
  useEffect(() => {
    if (user && userLocation) {
      fetchWeatherData().catch((error) => console.error('Weather refetch failed:', error));
    }
  }, [user, userLocation]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all data in parallel for better performance
      const [tasksResult, eventsResult, sessionsResult] = await Promise.allSettled([
        supabase
          .from('tasks')
          .select('*')
          .eq('user_id', user?.id)
          .gte('due_date', calendarStart.toISOString())
          .lte('due_date', calendarEnd.toISOString()),
        
        supabase
          .from('events')
          .select('*')
          .eq('user_id', user?.id)
          .gte('start_time', calendarStart.toISOString())
          .lte('start_time', calendarEnd.toISOString()),
        
        supabase
          .from('study_sessions')
          .select('*')
          .eq('user_id', user?.id)
          .gte('start_time', calendarStart.toISOString())
          .lte('start_time', calendarEnd.toISOString())
      ]);

      // Set data from successful requests
      if (tasksResult.status === 'fulfilled') {
        setTasks(tasksResult.value.data || []);
      }
      if (eventsResult.status === 'fulfilled') {
        setEvents(eventsResult.value.data || []);
      }
      if (sessionsResult.status === 'fulfilled') {
        setStudySessions(sessionsResult.value.data || []);
      }

      // Fetch weather data in parallel (don't block calendar render)
      if (userLocation) {
        fetchWeatherData().catch(error => 
          console.error('Weather fetch failed:', error)
        );
      }
    } catch (error) {
      console.error('Error fetching calendar data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWeatherData = async () => {
    if (!userLocation) return;

    try {
      const { data, error } = await supabase.functions.invoke('get-weather', {
        body: { 
          lat: userLocation.lat, 
          lon: userLocation.lon 
        }
      });

      if (error) {
        console.error('Error fetching weather:', error);
        return;
      }

      // Process the weather data - get current day + 7 days
      const forecastData: { [key: string]: WeatherData } = {};
      
      // Add current day weather
      if (data.current) {
        const today = format(new Date(), 'yyyy-MM-dd');
        forecastData[today] = {
          temp: data.current.temp,
          maxTemp: data.current.temp,
          minTemp: data.current.temp,
          description: data.current.description,
          icon: data.current.icon,
          humidity: data.current.humidity,
          windSpeed: data.current.windSpeed
        };
      }
      
      if (data.forecast) {
        data.forecast.forEach((day: any) => {
          const date = new Date(day.date);
          const dateKey = format(date, 'yyyy-MM-dd');
          forecastData[dateKey] = {
            temp: day.temp,
            maxTemp: day.maxTemp,
            minTemp: day.minTemp,
            description: day.description,
            icon: day.icon,
            humidity: day.humidity,
            windSpeed: day.windSpeed
          };
        });
      }

      setWeather({
        current: data.current,
        forecast: forecastData
      });
    } catch (error) {
      console.error('Error fetching weather data:', error);
    }
  };

  // Function to manually refresh weather data
  const refreshWeather = async () => {
    try {
      await fetchWeatherData();
    } catch (error) {
      console.error('Error refreshing weather:', error);
    }
  };

  const getWeatherIcon = (iconCode: string) => {
    // More precise OpenWeatherMap icon mapping for better accuracy
    const iconMap: { [key: string]: JSX.Element } = {
      '01d': <Sun className="h-4 w-4 text-yellow-500" />, // clear sky day
      '01n': <Sun className="h-4 w-4 text-yellow-400" />, // clear sky night
      '02d': <Cloud className="h-4 w-4 text-gray-400" />, // few clouds day
      '02n': <Cloud className="h-4 w-4 text-gray-500" />, // few clouds night
      '03d': <Cloud className="h-4 w-4 text-gray-500" />, // scattered clouds
      '03n': <Cloud className="h-4 w-4 text-gray-600" />,
      '04d': <Cloud className="h-4 w-4 text-gray-600" />, // broken clouds
      '04n': <Cloud className="h-4 w-4 text-gray-700" />,
      '09d': <CloudRain className="h-4 w-4 text-blue-500" />, // shower rain
      '09n': <CloudRain className="h-4 w-4 text-blue-600" />,
      '10d': <CloudRain className="h-4 w-4 text-blue-500" />, // rain
      '10n': <CloudRain className="h-4 w-4 text-blue-600" />,
      '11d': <CloudRain className="h-4 w-4 text-purple-500" />, // thunderstorm
      '11n': <CloudRain className="h-4 w-4 text-purple-600" />,
      '13d': <Snowflake className="h-4 w-4 text-blue-200" />, // snow
      '13n': <Snowflake className="h-4 w-4 text-blue-300" />,
      '50d': <Cloud className="h-4 w-4 text-gray-300" />, // mist
      '50n': <Cloud className="h-4 w-4 text-gray-400" />
    };
    
    return iconMap[iconCode] || <Sun className="h-4 w-4 text-yellow-500" />;
  };

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 4: return "bg-red-500"; // Critical
      case 3: return "bg-orange-500"; // High
      case 2: return "bg-yellow-500"; // Medium
      case 1: return "bg-green-500"; // Low
      default: return "bg-blue-500"; // Default
    }
  };

  const getPriorityLabel = (priority: number) => {
    switch (priority) {
      case 4: return "Critical";
      case 3: return "High";
      case 2: return "Medium"; 
      case 1: return "Low";
      default: return "Medium";
    }
  };

  const getPriorityIcon = (priority: number) => {
    switch (priority) {
      case 4: return <AlertTriangle className="h-3 w-3 text-red-500" />;
      case 3: return <Clock className="h-3 w-3 text-orange-500" />;
      case 2: return <BookOpen className="h-3 w-3 text-yellow-600" />;
      case 1: return <CheckCircle className="h-3 w-3 text-green-500" />;
      default: return <BookOpen className="h-3 w-3 text-blue-500" />;
    }
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
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <h2 className="text-lg font-semibold text-foreground">Loading Calendar...</h2>
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
        <div className="flex gap-2 items-center">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={refreshWeather}
            className="flex items-center gap-2"
          >
            <Thermometer className="h-4 w-4" />
            Refresh Weather
          </Button>
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
          const dayWeather = weather.forecast[format(day, 'yyyy-MM-dd')];
          const highestPriority = Math.max(...dayTasks.map(t => t.priority_score || 0), 0);
          const isCurrentMonth = isSameMonth(day, currentDate);

          return (
            <Card key={index} className={`min-h-[200px] p-2 transition-all duration-200 ${
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
                      {getWeatherIcon(dayWeather.icon)}
                      <span className="text-xs text-muted-foreground">
                        {dayWeather.maxTemp && dayWeather.minTemp 
                          ? `${dayWeather.maxTemp}°/${dayWeather.minTemp}°F`
                          : `${dayWeather.temp}°F`
                        }
                      </span>
                    </div>
                  )}
                </div>


                {/* Only show content for current month days */}
                {isCurrentMonth && (
                  <>
                    {/* Tasks with individual priority indicators */}
                    {dayTasks.slice(0, 2).map(task => (
                      <div key={task.id} className="flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getPriorityColor(task.priority_score || 2)}`} />
                        <Badge variant="secondary" className="text-xs flex-1 justify-start overflow-hidden group">
                          <div className="flex items-center gap-1 group-hover:animate-[scroll-text_3s_linear_infinite]">
                            📝 <span className="whitespace-nowrap text-xs">{task.title}</span>
                          </div>
                        </Badge>
                      </div>
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

      {/* Current Weather Display */}
      {weather.current && (
        <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 rounded-lg border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-2xl">
                {getWeatherIcon(weather.current.icon)}
              </div>
              <div>
                <div className="text-lg font-semibold text-foreground">
                  {weather.current.temp}°F
                </div>
                <div className="text-sm text-muted-foreground capitalize">
                  {weather.current.description}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {weather.current.location && (
                <div className="text-sm text-muted-foreground">
                  📍 {weather.current.location}
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={refreshWeather}
                className="h-8 w-8 p-0"
              >
                <Thermometer className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-6 flex flex-wrap gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>📝 Tasks</span>
          <span>📅 Events</span>
          <span>📚 Study Sessions</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span>Critical Priority</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500" />
            <span>High Priority</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <span>Medium Priority</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span>Low Priority</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Calendar;