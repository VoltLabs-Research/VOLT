export default function normalizePerAtomProperties(input: unknown): string[] {
    if (!Array.isArray(input)) {
        return [];
    }

    return Array.from(
        new Set(
            input
                .filter((property): property is string => typeof property === 'string')
                .map((property) => property.trim())
                .filter((property) => property.length > 0)
        )
    );
}