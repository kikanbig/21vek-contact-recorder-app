// Система логирования для отладки в мобильном приложении

interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  data?: any;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 100;

  private addLog(level: LogEntry['level'], message: string, data?: any) {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data: data ? JSON.stringify(data, null, 2) : undefined
    };
    
    this.logs.push(logEntry);
    
    // Ограничиваем количество логов
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
    
    // Дублируем в консоль
    const emoji = level === 'ERROR' ? '❌' : level === 'WARN' ? '⚠️' : '📝';
    console.log(`${emoji} [${level}] ${message}`, data || '');
  }

  info(message: string, data?: any) {
    this.addLog('INFO', message, data);
  }

  warn(message: string, data?: any) {
    this.addLog('WARN', message, data);
  }

  error(message: string, data?: any) {
    this.addLog('ERROR', message, data);
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clearLogs() {
    this.logs = [];
  }

  getLogsAsText(): string {
    return this.logs.map(log => {
      const time = new Date(log.timestamp).toLocaleTimeString('ru-RU');
      let result = `[${time}] ${log.level}: ${log.message}`;
      if (log.data) {
        result += `\nData: ${log.data}`;
      }
      return result;
    }).join('\n\n');
  }
}

export const logger = new Logger(); 