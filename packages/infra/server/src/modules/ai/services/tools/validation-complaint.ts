import type { IValidation } from 'typia';

const MAX_FAULTS = 3;
const INPUT = '$input.';
const CLIPPED = 60;

const where = (path: string): string => path.startsWith(INPUT) ? path.slice(INPUT.length) : path;

const got = (value: unknown): string => {
    if (value === undefined) return 'nothing';
    if (value === null) return 'null';
    if (Array.isArray(value)) return `an array of ${value.length}`;
    if (typeof value === 'object') return `an object with ${Object.keys(value).join(', ')}`;
    if (typeof value === 'string') {
        return value.length > CLIPPED
            ? `a string of ${value.length} characters starting "${value.slice(0, CLIPPED)}"`
            : JSON.stringify(value);
    }

    return JSON.stringify(value);
};

// What the model reads when its arguments are rejected: each fault, what it sent instead, and the fix.
export const complaintOf = (toolName: string, faults: IValidation.IError[]): string => {
    if (faults.length === 0) return `${toolName} rejected the arguments.`;

    const named = faults.slice(0, MAX_FAULTS)
        .map((fault) => `${where(fault.path)} must be ${fault.expected}, and you sent ${got(fault.value)}`)
        .join('; ');
    const rest = faults.length > MAX_FAULTS ? `, and ${faults.length - MAX_FAULTS} more` : '';

    return `${toolName} did not accept those arguments: ${named}${rest}. Fix exactly that and call it again.`;
};
