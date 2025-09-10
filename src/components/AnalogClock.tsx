import { useState, useEffect } from 'react';

export const AnalogClock = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const seconds = time.getSeconds();
  const minutes = time.getMinutes();
  const hours = time.getHours() % 12;

  const secondAngle = (seconds * 6) - 90; // 6 degrees per second
  const minuteAngle = (minutes * 6) + (seconds * 0.1) - 90; // 6 degrees per minute + smooth seconds
  const hourAngle = (hours * 30) + (minutes * 0.5) - 90; // 30 degrees per hour + smooth minutes

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="flex flex-col items-center p-4 bg-card/50 border border-border rounded-lg backdrop-blur-sm">
      {/* Analog Clock */}
      <div className="relative w-24 h-24 mb-3">
        <svg className="w-full h-full" viewBox="0 0 100 100">
          {/* Clock face */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="transparent"
            stroke="hsl(var(--border))"
            strokeWidth="2"
            className="drop-shadow-sm"
          />
          
          {/* Hour markers */}
          {Array.from({ length: 12 }, (_, i) => (
            <line
              key={i}
              x1="50"
              y1="10"
              x2="50"
              y2="18"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth="2"
              transform={`rotate(${i * 30} 50 50)`}
            />
          ))}
          
          {/* Minute markers */}
          {Array.from({ length: 60 }, (_, i) => (
            i % 5 !== 0 && (
              <line
                key={i}
                x1="50"
                y1="10"
                x2="50"
                y2="15"
                stroke="hsl(var(--muted-foreground))"
                strokeWidth="0.5"
                opacity="0.6"
                transform={`rotate(${i * 6} 50 50)`}
              />
            )
          ))}
          
          {/* Hour hand */}
          <line
            x1="50"
            y1="50"
            x2="50"
            y2="30"
            stroke="hsl(var(--foreground))"
            strokeWidth="3"
            strokeLinecap="round"
            transform={`rotate(${hourAngle} 50 50)`}
            className="drop-shadow-sm"
          />
          
          {/* Minute hand */}
          <line
            x1="50"
            y1="50"
            x2="50"
            y2="20"
            stroke="hsl(var(--foreground))"
            strokeWidth="2"
            strokeLinecap="round"
            transform={`rotate(${minuteAngle} 50 50)`}
            className="drop-shadow-sm"
          />
          
          {/* Second hand */}
          <line
            x1="50"
            y1="50"
            x2="50"
            y2="15"
            stroke="hsl(var(--destructive))"
            strokeWidth="1"
            strokeLinecap="round"
            transform={`rotate(${secondAngle} 50 50)`}
            className="drop-shadow-sm"
          />
          
          {/* Center dot */}
          <circle
            cx="50"
            cy="50"
            r="3"
            fill="hsl(var(--foreground))"
            className="drop-shadow-sm"
          />
        </svg>
      </div>
      
      {/* Digital time */}
      <div className="text-center">
        <div className="text-sm font-medium text-foreground mb-1">
          {time.toLocaleTimeString('en-US', {
            hour12: true,
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit'
          })}
        </div>
        <div className="text-xs text-muted-foreground">
          {formatDate(time)}
        </div>
      </div>
    </div>
  );
};