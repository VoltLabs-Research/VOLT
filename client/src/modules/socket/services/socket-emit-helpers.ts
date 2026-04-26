import socketService from './socket-service';
import { socketErrorReporter } from './socket-error-reporter';

export const emitOrReport = async (event: string, data?: unknown): Promise<void> => {
    try {
        await socketService.emit(event, data);
    } catch (error) {
        socketErrorReporter.report(error, { kind: 'emit', event });
    }
};

export const emitOrSwallow = async (event: string, data?: unknown): Promise<void> => {
    try {
        await socketService.emit(event, data);
    } catch {
    }
};

export const emitWithReport = async <T = unknown>(event: string, data?: unknown): Promise<T> => {
    try {
        return await socketService.emit<T>(event, data);
    } catch (error) {
        socketErrorReporter.report(error, { kind: 'emit', event });
        throw error;
    }
};
