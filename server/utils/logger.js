import fs from 'fs';
import path from 'path';

// Create logs directory if it doesn't exist
const logsDir = process.env.LOG_DIR || './logs';
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

class Logger {
  constructor() {
    this.logLevel = process.env.LOG_LEVEL || 'info'; // debug, info, warn, error
    this.levels = { debug: 0, info: 1, warn: 2, error: 3 };
  }

  formatTimestamp() {
    return new Date().toISOString();
  }

  log(level, message, meta = {}) {
    if (this.levels[level] < this.levels[this.logLevel]) return;

    const timestamp = this.formatTimestamp();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    const logEntry = JSON.stringify({ timestamp, level, message, ...meta });

    // Console output
    const color = colors[level === 'error' ? 'red' : level === 'warn' ? 'yellow' : level === 'debug' ? 'cyan' : 'green'];
    console.log(`${color}${logMessage}${colors.reset}`);

    // File output
    const logFile = path.join(logsDir, `${level}.log`);
    fs.appendFileSync(logFile, logEntry + '\n', { encoding: 'utf8' });

    // All logs file
    const allLogsFile = path.join(logsDir, 'all.log');
    fs.appendFileSync(allLogsFile, logEntry + '\n', { encoding: 'utf8' });
  }

  debug(message, meta) {
    this.log('debug', message, meta);
  }

  info(message, meta) {
    this.log('info', message, meta);
  }

  warn(message, meta) {
    this.log('warn', message, meta);
  }

  error(message, meta) {
    this.log('error', message, meta);
  }
}

export default new Logger();
