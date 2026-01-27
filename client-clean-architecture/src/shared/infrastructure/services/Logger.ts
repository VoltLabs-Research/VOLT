const isDevelopment = import.meta.env.VITE_ENV === 'development';

class Logger {
    public readonly name: string;

    constructor(name: string) {
        this.name = name;
    }

    private formatMessage(level: string, ...args: any[]) {
        return [`[${this.name}] - ${level}:`, ...args];
    }

    log(...args: any[]) {
        if (isDevelopment) {
            console.log(...this.formatMessage('LOG', ...args));
        }
    }

    warn(...args: any[]) {
        if (isDevelopment) {
            console.log(...this.formatMessage('WARN', ...args));
        }
    }

    error(...args: any[]) {
        console.error(...this.formatMessage('ERROR', ...args));
    }
}

export default Logger;
