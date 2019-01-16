
'use strict';
const { createLogger, format, transports } = require('winston');
const fs = require('fs');
const path = require('path');

const env = process.env.NODE_ENV || 'development';
const logDir = 'log';


var config = require('config');
const localLogDir = config.get('LOG.localLogDir');
const masterLogFile = path.join(localLogDir,config.get('LOG.masterLogFile'));




// Create the log directory if it does not exist
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

//const filename = path.join(logDir, 'results.log');

const logger = createLogger({
  // change level if in dev environment versus production
  level: env === 'development' ? 'debug' : 'info',
  format: format.combine(
    format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    format.json()
  ),
  transports: [
    new transports.Console({
      level: 'info',
      format: format.combine(
        format.colorize(),
        format.printf(
          info => `${info.timestamp} ${info.level}: ${info.message}`
        )
      )
    }),
    new transports.File({ filename: masterLogFile })
  ]
});

logger.info('2Hello world');
logger.warn('2Warning message');
logger.debug('2Debugging info');