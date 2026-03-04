type ListingFieldKind = 'primitive' | 'array' | 'object';

interface ListingField {
    path: string;
    label: string;
    kind: ListingFieldKind;
    labels?: string[];
    schemaKeys?: string[];
}

interface ParsedSchemaAnnotations {
    listingFields: ListingField[];
    perAtomProperties: string[];
    perAtomIterablePath: string | null;
}

const PRIMITIVE_TYPES = new Set(['string', 'int', 'float', 'boolean']);

const isPrimitive = (value: unknown): boolean => {
    if (typeof value === 'string') return true;
    if (typeof value !== 'object' || value === null) return false;
    const typeValue = (value as Record<string, unknown>).type;
    if (typeof typeValue === 'string' && PRIMITIVE_TYPES.has(typeValue)) return true;
    return false;
};

const isArrayType = (value: unknown): boolean => {
    if (typeof value !== 'object' || value === null) return false;
    return (value as Record<string, unknown>).type === 'array';
};

const isObjectType = (value: unknown): boolean => {
    if (typeof value !== 'object' || value === null) return false;
    return (value as Record<string, unknown>).type === 'object';
};

const walkSchema = (
    definition: Record<string, unknown>,
    prefix: string,
    listingFields: ListingField[],
    perAtomProperties: string[],
    result: { perAtomIterablePath: string | null }
): void => {
    for (const [key, value] of Object.entries(definition)) {
        if (value === null || value === undefined) continue;

        const currentPath = prefix ? `${prefix}.${key}` : key;

        if (isPrimitive(value)) {
            const record = typeof value === 'object' ? value as Record<string, unknown> : null;
            if (record?.listing === true) {
                const label = typeof record.label === 'string' ? record.label : key;
                listingFields.push({
                    path: currentPath,
                    label,
                    kind: 'primitive'
                });
            }
            continue;
        }

        if (typeof value !== 'object') continue;
        const record = value as Record<string, unknown>;

        if (isArrayType(record)) {
            if (record.perAtom === true) {
                result.perAtomIterablePath = currentPath;

                const items = record.items;
                if (items && typeof items === 'object' && !Array.isArray(items)) {
                    for (const [itemKey, itemValue] of Object.entries(items as Record<string, unknown>)) {
                        if (itemValue && typeof itemValue === 'object' && (itemValue as Record<string, unknown>).perAtom === true) {
                            perAtomProperties.push(itemKey);
                        }
                    }
                }
            }

            if (record.listing === true) {
                const label = typeof record.label === 'string' ? record.label : key;
                const labels = Array.isArray(record.labels)
                    ? (record.labels as unknown[]).filter((l): l is string => typeof l === 'string')
                    : undefined;

                if (labels && labels.length > 0) {
                    listingFields.push({
                        path: currentPath,
                        label,
                        kind: 'array',
                        labels
                    });
                } else {
                    listingFields.push({
                        path: currentPath,
                        label,
                        kind: 'primitive'
                    });
                }
            }
            continue;
        }

        if (isObjectType(record)) {
            if (record.listing === true) {
                const label = typeof record.label === 'string' ? record.label : key;
                const schema = record.schema;
                const schemaKeys = schema && typeof schema === 'object' && !Array.isArray(schema)
                    ? Object.keys(schema as Record<string, unknown>)
                    : [];

                listingFields.push({
                    path: currentPath,
                    label,
                    kind: 'object',
                    schemaKeys
                });
            }
            continue;
        }

        if (!record.type) {
            walkSchema(record as Record<string, unknown>, currentPath, listingFields, perAtomProperties, result);
        }
    }
};

export const parseSchemaAnnotations = (definition: Record<string, unknown>): ParsedSchemaAnnotations => {
    const listingFields: ListingField[] = [];
    const perAtomProperties: string[] = [];
    const result = { perAtomIterablePath: null as string | null };

    walkSchema(definition, '', listingFields, perAtomProperties, result);

    return {
        listingFields,
        perAtomProperties,
        perAtomIterablePath: result.perAtomIterablePath
    };
};

export type { ListingField, ListingFieldKind, ParsedSchemaAnnotations };
