const fs = require('fs');
const path = require('path');

const logsDir = path.resolve(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}
const logFilePath = path.join(logsDir, 'app.log');

function formatTime() {
  return new Date().toISOString();
}

function writeToFile(level, message) {
  try {
    const formattedMsg = `[${formatTime()}] [${level}] ${message}\n`;
    fs.appendFileSync(logFilePath, formattedMsg, 'utf-8');
  } catch (err) {
    // Ignore log file write errors
  }
}

const logger = {
  info: (...args) => {
    const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
    console.log(`[${formatTime()}] [INFO]`, ...args);
    writeToFile('INFO', msg);
  },
  warn: (...args) => {
    const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
    console.warn(`[${formatTime()}] [WARN]`, ...args);
    writeToFile('WARN', msg);
  },
  error: (...args) => {
    const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
    console.error(`[${formatTime()}] [ERROR]`, ...args);
    writeToFile('ERROR', msg);
  }
};

module.exports = logger;
