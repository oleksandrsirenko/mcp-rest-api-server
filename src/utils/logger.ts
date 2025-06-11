import winston from 'winston';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

// Define log colors
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue',
};

winston.addColors(colors);

// Get configuration from environment
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LOG_FORMAT = process.env.LOG_FORMAT || 'json';
const LOG_FILE = process.env.LOG_FILE;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Create formatters
const developmentFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaString = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${metaString}`;
  })
);

const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create transports
const transports: winston.transport[] = [
  new winston.transports.Console({
    level: LOG_LEVEL,
    format: NODE_ENV === 'development' ? developmentFormat : productionFormat,
  }),
];

// Add file transport if specified
if (LOG_FILE) {
  transports.push(
    new winston.transports.File({
      filename: LOG_FILE,
      level: LOG_LEVEL,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
    })
  );
}

// Create logger instance
export const logger = winston.createLogger({
  levels,
  level: LOG_LEVEL,
  transports,
  exitOnError: false,
  // Prevent logging of internal winston errors
  silent: false,
});

// Create child loggers for different components
export const createChildLogger = (component: string) => {
  return logger.child({ component });
};

// Export specific loggers for common components
export const serverLogger = createChildLogger('server');
export const apiLogger = createChildLogger('api');
export const cacheLogger = createChildLogger('cache');
export const configLogger = createChildLogger('config');
export const redisLogger = createChildLogger('redis');

// Log startup information
if (NODE_ENV !== 'test') {
  logger.info('Logger initialized', {
    level: LOG_LEVEL,
    format: LOG_FORMAT,
    environment: NODE_ENV,
    fileLogging: !!LOG_FILE,
  });
}