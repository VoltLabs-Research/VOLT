import type { QueryKey } from '@tanstack/react-query';

type KeyFnMap<T extends object> = {
    [K in keyof T]: T[K] extends void
        ? (params?: void) => QueryKey
        : (() => QueryKey) & ((params: T[K]) => QueryKey);
} & {
    prefix: () => QueryKey;
};

export function buildKeys<T extends object>(base: string | readonly string[]): KeyFnMap<T>;
export function buildKeys(base: string | readonly string[]) {
    const baseSegments = typeof base === 'string' ? [base] : [...base];

    return new Proxy({ prefix: () => [...baseSegments] }, {
        get: (_, key: string) => {
            if (key === 'prefix') {
                return () => [...baseSegments];
            }

            return (params: unknown) => {
                if (params === undefined || params === null) {
                    return [...baseSegments, key];
                }

                return [...baseSegments, key, params];
            };
        }
    });
};
