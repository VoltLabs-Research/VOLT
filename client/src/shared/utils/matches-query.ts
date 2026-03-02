export const matchesQuery = (value: string, query: string): boolean => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
        return true;
    }

    return value.toLowerCase().includes(normalizedQuery);
};
