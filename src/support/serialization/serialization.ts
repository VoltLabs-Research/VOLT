import { z } from 'zod';

interface SerializableObject {
    [key: string]: SerializableValue | undefined;
}

type SerializableValue = bigint | boolean | Date | Function | null | number | SerializableObject | SerializableValue[] | string | symbol | undefined;

const CLI_ARGUMENTS_TOKEN_PREFIX = '__volt_cli_args__:';
const CLI_ARGUMENTS_TOKEN_SCHEMA = z.string().array();

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
        return CLI_ARGUMENTS_TOKEN_SCHEMA.parse(JSON.parse(payload));
    } catch {
        return null;
    }
};

export const stringifyUnknown = (value: SerializableValue): string => {
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
