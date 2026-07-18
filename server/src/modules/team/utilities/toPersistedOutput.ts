interface PopulatableDocument {
    toObject(opts?: Record<string, unknown>): Record<string, unknown>;
    _id: unknown;
    populated?: (path: string) => unknown;
}

export const toPersistedOutput = <T>(
    doc: PopulatableDocument,
    relationKeys: string[] = []
): T & { _id: string } => {
    const documentProps = doc.toObject({ flattenMaps: true });
    const { _id, __v: _ignoredVersion, ...rest } = documentProps;

    for (const key of relationKeys) {
        const value = Reflect.get(doc, key);

        if (!value) continue;
        if (doc.populated?.(key)) continue;

        rest[key] = Array.isArray(value)
            ? value.map((relationValue: unknown) => String(relationValue))
            : String(value);
    }

    return { _id: String(_id), ...rest } as T & { _id: string };
};
