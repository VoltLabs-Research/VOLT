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
