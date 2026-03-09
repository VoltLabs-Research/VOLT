import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

export const logger = pino(
    {
        level: process.env.LOG_LEVEL || 'info',
        timestamp: pino.stdTimeFunctions.isoTime,
        formatters: {
            bindings: () => ({})
        }
    },
    isProduction
        ? undefined
        : pino.transport({
            target: 'pino-pretty',
            options: {
                colorize: true,
                ignore: 'pid,hostname',
                translateTime: 'SYS:standard',
                singleLine: true
            }
        })
);
