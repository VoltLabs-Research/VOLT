export const withDefaults = <T extends object>(defaults: T, overrides?: Partial<T>): T => ({
    ...defaults,
    ...overrides
});

export const withNestedDefaults = <T extends object>(defaults: T, overrides?: Partial<T>): T => {
    const merged = {} as T;
    for (const key of Object.keys(defaults) as Array<keyof T>) {
        merged[key] = {
            ...defaults[key],
            ...overrides?.[key]
        };
    }
    return merged;
};
