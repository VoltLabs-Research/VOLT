import type { IValidation } from 'typia';

const MAX_REPORTED_ERRORS = 5;

export const formatValidationErrors = (errors: IValidation.IError[]): string => {
    const details = errors
        .slice(0, MAX_REPORTED_ERRORS)
        .map((error) => `${error.path.replace(/^\$input\.?/, '') || 'input'} expected ${error.expected}`)
        .join('; ');

    return `${details}${errors.length > MAX_REPORTED_ERRORS ? ` (+${errors.length - MAX_REPORTED_ERRORS} more)` : ''}`;
};
