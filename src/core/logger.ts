import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';
const DEFAULT_LOG_LEVEL: pino.LevelWithSilent = 'info';
const supportedLogLevels = new Set<pino.LevelWithSilent>([
    'fatal',
    'error',
    'warn',
    'info',
    'debug',
    'trace',
    'silent'
]);

function resolveLogLevel(value: string | undefined): pino.LevelWithSilent {
    const normalized = value?.trim().toLowerCase();
    if (normalized && supportedLogLevels.has(normalized as pino.LevelWithSilent)) {
        return normalized as pino.LevelWithSilent;
    }

    return DEFAULT_LOG_LEVEL;
}

export const logger = pino(
    {
        level: resolveLogLevel(process.env.LOG_LEVEL),
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
