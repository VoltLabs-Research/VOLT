import type { ZodError } from 'zod/v4';

export const formatSocketValidationError = (error: ZodError): string => {
    return error.issues
        .map((issue) => {
            const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
            return `${path}${issue.message}`;
        })
        .join('; ');
};
