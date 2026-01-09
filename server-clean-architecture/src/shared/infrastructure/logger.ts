import pino from 'pino';

const level = (process.env.LOG_LEVEL as pino.LevelWithSilent | undefined) ?? 'info';
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
