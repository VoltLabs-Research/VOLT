export const deepMerge = <T extends object>(base: T, patch: Partial<T>): T => {
    const out: any = Array.isArray(base) ? [...base] : { ...base };
    for (const key in patch) {
        const value: any = (patch as any)[key];
        if (value === undefined) continue;
        if (Array.isArray(value)) {
            out[key] = [...value];
        } else if (value && typeof value === 'object' && !Array.isArray(value)) {
            out[key] = deepMerge((out[key] ?? {}) as any, value);
        } else {
            out[key] = value;
        }
    }

    return out;
};
