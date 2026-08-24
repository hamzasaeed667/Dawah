const fs = require('fs');
const path = require('path');

const isServerless = !!(process.env.NETLIFY || process.env.LAMBDA_TASK_ROOT || process.env.VERCEL);
const logsDir = isServerless ? path.join('/tmp', 'logs') : path.resolve(__dirname, '../logs');
let fileLoggingAvailable = false;

try {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  fileLoggingAvailable = true;
} catch (e) {
  fileLoggingAvailable = false;
}

const logFilePath = path.join(logsDir, 'app.log');

function formatTime() {
  return new Date().toISOString();
}

function writeToFile(level, message) {
  if (!fileLoggingAvailable) return;
  try {
    const formattedMsg = `[${formatTime()}] [${level}] ${message}\n`;
    fs.appendFileSync(logFilePath, formattedMsg, 'utf-8');
  } catch (err) {
    // Ignore log file write errors in read-only / restricted environments
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
