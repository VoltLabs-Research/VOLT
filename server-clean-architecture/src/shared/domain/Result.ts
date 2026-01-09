export type Result<T, E = Error> = 
    | { success: true, value: T }
    | { success: false, error: E };

export const Result = {
    /**
     * Create a successful result.
     */
    ok: <T>(value: T): Result<T, never> => ({ success: true, value }),
    
    /**
     * Create a failed result.
     */
    fail: <E>(error: E): Result<never, E> => ({ success: false, error }),
};