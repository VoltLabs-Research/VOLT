const CLI_ARGUMENTS_TOKEN_PREFIX = '__volt_cli_args__:';

export const encodeCliArgumentsToken = (argumentsArray: string[]): string => {
    const payload = JSON.stringify(argumentsArray);
    const encodedPayload = Buffer.from(payload, 'utf8').toString('base64url');

    return `${CLI_ARGUMENTS_TOKEN_PREFIX}${encodedPayload}`;
};

export const decodeCliArgumentsToken = (value: string): string[] | null => {
    if (!value.startsWith(CLI_ARGUMENTS_TOKEN_PREFIX)) {
        return null;
    }

    const encodedPayload = value.slice(CLI_ARGUMENTS_TOKEN_PREFIX.length);
    if (!encodedPayload.length) {
        return null;
    }

    try {
        const payload = Buffer.from(encodedPayload, 'base64url').toString('utf8');
        const parsed = JSON.parse(payload);
        if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== 'string')) {
            return null;
        }
        return parsed as string[];
    } catch {
        return null;
    }
};

export const stringifyUnknown = (value: unknown): string => {
    if (typeof value === 'string') {
        return value;
    }

    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
        return `${value}`;
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    if (value === null) {
        return 'null';
    }

    if (typeof value === 'undefined') {
        return '';
    }

    if (typeof value === 'symbol' || typeof value === 'function') {
        return value.toString();
    }

    try {
        const serializedValue = JSON.stringify(value);
        if (serializedValue === undefined) {
            return '';
        }

        return serializedValue;
    } catch {
        return '';
    }
};
