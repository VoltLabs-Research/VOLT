import { logger } from '@/core/logger';

export const errorMessage = (error: unknown): string =>
    error instanceof Error ? error.message : String(error);

export const safeExecute = async <T>(
    op: () => Promise<T>,
    onError: (err: unknown) => void = () => {}
): Promise<T | undefined> => {
    try {
        return await op();
    } catch (err) {
        onError(err);
        return undefined;
    }
};

export const logAndSwallow =
    (level: 'warn' | 'error', ctx: Record<string, unknown>, msg: string) =>
    (err: unknown): void => {
        logger[level]({ err, ...ctx }, `${msg}: ${errorMessage(err)}`);
    };
