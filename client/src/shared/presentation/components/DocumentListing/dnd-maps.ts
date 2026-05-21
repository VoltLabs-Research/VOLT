export const buildItemMapByGeneratedId = <T>(
    items: T[],
    enabled: boolean,
    getId: (item: T) => string | null | undefined
): Map<string, T> => {
    const nextMap = new Map<string, T>();
    if (!enabled) {
        return nextMap;
    }

    items.forEach((item) => {
        const id = getId(item);
        if (id) {
            nextMap.set(id, item);
        }
    });

    return nextMap;
};
