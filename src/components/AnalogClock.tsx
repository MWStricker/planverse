import { useState, useEffect } from 'react';

export const AnalogClock = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="flex flex-col items-center p-3 bg-card/50 border border-border rounded-lg backdrop-blur-sm">
      {/* Digital time */}
      <div className="text-center">
        <div className="text-lg font-mono font-bold text-foreground mb-1 tracking-wide">
          {time.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
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