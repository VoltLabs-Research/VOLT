import { isRecord } from '@/support/type-guards/isRecord';

interface HexStringSerializable {
    toHexString(): string;
}

interface StringSerializable {
    toString(): string;
}

const CLI_ARGUMENTS_TOKEN_PREFIX = '__volt_cli_args__:';

const hasToHexString = (value: unknown): value is HexStringSerializable => {
    return isRecord(value) && typeof value.toHexString === 'function';
};

const hasToString = (value: unknown): value is StringSerializable => {
    return isRecord(value) && typeof value.toString === 'function';
};

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
        const parsedPayload = JSON.parse(payload);
        const argumentsArray = Array.isArray(parsedPayload)
            ? parsedPayload.filter((entry): entry is string => typeof entry === 'string')
            : [];

        return argumentsArray.length === parsedPayload.length
            ? argumentsArray
            : null;
    } catch {
        return null;
    }
};

export const stringifyUnknown = (value: unknown): string => {
    if (typeof value === 'string') {
        return value;
    }

    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
        return String(value);
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    if (value === null) {
        return 'null';
    }

    if (Array.isArray(value) || isRecord(value)) {
        try {
            return JSON.stringify(value);
        } catch {
            return '';
        }
    }

    if (hasToHexString(value)) {
        return value.toHexString();
    }

    if (hasToString(value)) {
        const serializedValue = value.toString();
        return serializedValue === '[object Object]' ? '' : serializedValue;
    }

    if (typeof value === 'undefined') {
        return '';
    }

    return String(value);
};
