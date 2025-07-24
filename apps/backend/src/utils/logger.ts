import winston from 'winston';

const logLevel = process.env.LOG_LEVEL || 'info';

// Custom log format for development
const devFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      metaStr = `\n${JSON.stringify(meta, null, 2)}`;
    }
    return `${timestamp} [${level}] ${message}${metaStr}`;
  })
);

// Production format (JSON for log aggregation)
const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const logger = winston.createLogger({
  level: logLevel,
  format: process.env.NODE_ENV === 'production' ? prodFormat : devFormat,
  transports: [
    // Console transport with environment-specific format
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production' ? prodFormat : devFormat
    }),
    
    // File transports for production
    ...(process.env.NODE_ENV === 'production' ? [
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5
      }),
      new winston.transports.File({
        filename: 'logs/combined.log',
        maxsize: 5242880, // 5MB
        maxFiles: 5
      })
    ] : [])
  ]
});

// Remove duplicate console transport addition - this was causing duplicate logs in development

export { logger }; 