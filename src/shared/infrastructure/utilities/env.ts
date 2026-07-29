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
