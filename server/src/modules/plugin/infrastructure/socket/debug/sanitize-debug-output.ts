import { isRecord } from '@shared/infrastructure/utilities/type-guards';

const isServerPath = (value: string): boolean => {
    return value.startsWith('/tmp/') || value.startsWith('/home/') || value.startsWith('/var/');
};

export const sanitizeDebugOutput = (
    data: Record<string, unknown>,
    maxArrayLength = 50,
    maxDepth = 5
): Record<string, unknown> => {
    const sanitize = (value: unknown, depth: number): unknown => {
        if (depth > maxDepth) {
            return '[max depth exceeded]';
        }

        if (value === null || value === undefined) {
            return value;
        }

        if (typeof value === 'string') {
            if (isServerPath(value)) {
                return '[server path]';
            }

            if (value.length > 2000) {
                return value.substring(0, 2000) + `... [truncated, total ${value.length} chars]`;
            }

            return value;
        }

        if (typeof value === 'number' || typeof value === 'boolean') {
            return value;
        }

        if (ArrayBuffer.isView(value)) {
            const typedArrayValue = value as unknown as {
                byteLength?: number;
                length?: number;
                slice?: (start: number, end?: number) => ArrayLike<unknown>;
            };
            const len = typedArrayValue.length ?? typedArrayValue.byteLength;
            const preview = typeof typedArrayValue.slice === 'function'
                ? Array.from(typedArrayValue.slice(0, 10))
                : [];

            return {
                _type: value.constructor.name,
                length: len,
                preview
            };
        }

        if (Array.isArray(value)) {
            if (value.length > maxArrayLength) {
                return {
                    _truncated: true,
                    totalLength: value.length,
                    preview: value.slice(0, maxArrayLength).map((item) => sanitize(item, depth + 1))
                };
            }

            return value.map((item) => sanitize(item, depth + 1));
        }

        if (isRecord(value)) {
            if (value instanceof Map) {
                const mapResult: Record<string, unknown> = {};
                value.forEach((item, key) => {
                    mapResult[String(key)] = sanitize(item, depth + 1);
                });
                return mapResult;
            }

            const objectResult: Record<string, unknown> = {};
            for (const [key, item] of Object.entries(value)) {
                objectResult[key] = sanitize(item, depth + 1);
            }
            return objectResult;
        }

        return String(value);
    };

    const result = sanitize(data, 0) as Record<string, unknown>;
    return result;
};
