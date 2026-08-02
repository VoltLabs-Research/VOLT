/**
 * Reads a strictly positive integer from the environment, or `undefined` when the
 * variable is unset or not a positive integer.
 *
 * Lives in `shared/infrastructure` because it reads `process.env`: it used to sit
 * in `shared/domain/utilities/runtime-capacity.ts`, which made the domain layer
 * depend on process configuration.
 */
export const readPositiveIntegerEnv = (name: string): number | undefined => {
    const rawValue = process.env[name];
    if (!rawValue || !/^[1-9]\d*$/.test(rawValue)) {
        return undefined;
    }

    return Number.parseInt(rawValue, 10);
};

export const readStringArrayEnv = (key: string, fallback: string[] | null): string[] | null => {
    const rawValue = process.env[key];
    if (!rawValue) {
        return fallback;
    }

    const values = rawValue
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);

    return values.length > 0 ? values : fallback;
};
