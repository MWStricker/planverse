interface LogEvent {
  level: 'info' | 'warn' | 'error';
  message: string;
  context?: Record<string, any>;
  timestamp: string;
}

class MonitoringService {
  private events: LogEvent[] = [];
  private maxEvents = 100; // Keep last 100 events in memory

  log(level: LogEvent['level'], message: string, context?: Record<string, any>) {
    const event: LogEvent = {
      level,
      message,
      context,
      timestamp: new Date().toISOString()
    };

    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    // Console output
    const logFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    logFn(`[${level.toUpperCase()}]`, message, context);

    // In production, send to external service
    if (import.meta.env.PROD && level === 'error') {
      this.sendToMonitoring(event);
    }
  }

  private async sendToMonitoring(event: LogEvent) {
    try {
      // Example: Send to your backend or external service
      // await fetch('/api/logs', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(event)
      // });
    } catch (error) {
      console.error('Failed to send log to monitoring service:', error);
    }
  }

  getRecentEvents() {
    return [...this.events];
  }

  clearEvents() {
    this.events = [];
  }
}

export const monitoring = new MonitoringService();
