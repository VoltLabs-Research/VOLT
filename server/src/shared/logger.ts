import pino from 'pino';

const LOG_LEVELS: pino.LevelWithSilent[] = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'];

const isLogLevel = (value: string): value is pino.LevelWithSilent => {
    return LOG_LEVELS.some((level) => level === value);
};

const resolveLogLevel = (): pino.LevelWithSilent => {
    const logLevel = process.env.LOG_LEVEL;

    if (!logLevel) {
        return 'debug';
    }

    if (isLogLevel(logLevel)) {
        return logLevel;
    }

    return 'debug';
};

const level = resolveLogLevel();
const isProd = process.env.NODE_ENV === 'production';

const logger = pino(
    {
        level,
        timestamp: pino.stdTimeFunctions.isoTime,
        formatters: {
            bindings: () => ({}),
        },
    },
    isProd
        ? undefined
        : pino.transport({
            target: "pino-pretty",
            options: {
            colorize: true,
            translateTime: "SYS:standard",
            singleLine: true,
            ignore: "pid, hostname",
            messageFormat: "{msg}",

            customLevels: {
                trace: 10,
                debug: 20,
                info: 30,
                warn: 40,
                error: 50,
                fatal: 60,
            },
        },
    })
);

export default logger;
