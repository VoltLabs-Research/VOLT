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

const parseSchemaAnnotations = (definition: Record<string, unknown>): ParsedSchemaAnnotations => {
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

const applyAnnotation = (
    definition: Record<string, unknown>,
    fieldPath: string,
    annotation: string,
    value: unknown
): Record<string, unknown> => {
    const cloned = structuredClone(definition);
    const keys = fieldPath.split('.');

    let current: Record<string, unknown> = cloned;
    for (let i = 0; i < keys.length - 1; i++) {
        const segment = keys[i];
        if (!current[segment] || typeof current[segment] !== 'object') {
            return cloned;
        }

        const next = current[segment] as Record<string, unknown>;
        if (next.type === 'array' && next.items && typeof next.items === 'object') {
            current = next.items as Record<string, unknown>;
            continue;
        }

        current = next;
    }

    const lastKey = keys[keys.length - 1];
    const target = current[lastKey];

    if (target === null || target === undefined) return cloned;

    if (typeof target === 'string') {
        current[lastKey] = {
            type: target,
            [annotation]: value
        };
    } else if (typeof target === 'object') {
        (target as Record<string, unknown>)[annotation] = value;
    }

    return cloned;
};

const removeAnnotation = (
    definition: Record<string, unknown>,
    fieldPath: string,
    annotation: string
): Record<string, unknown> => {
    const cloned = structuredClone(definition);
    const keys = fieldPath.split('.');

    let current: Record<string, unknown> = cloned;
    for (let i = 0; i < keys.length - 1; i++) {
        const segment = keys[i];
        if (!current[segment] || typeof current[segment] !== 'object') {
            return cloned;
        }

        const next = current[segment] as Record<string, unknown>;
        if (next.type === 'array' && next.items && typeof next.items === 'object') {
            current = next.items as Record<string, unknown>;
            continue;
        }

        current = next;
    }

    const lastKey = keys[keys.length - 1];
    const target = current[lastKey];

    if (target && typeof target === 'object') {
        delete (target as Record<string, unknown>)[annotation];
    }

    return cloned;
};

interface SchemaFieldDescriptor {
    path: string;
    name: string;
    type: string;
    isListing: boolean;
    isPerAtom: boolean;
    label: string;
    parentIsPerAtomArray: boolean;
}

const collectSchemaFields = (
    definition: Record<string, unknown>,
    prefix: string,
    parentPerAtom: boolean
): SchemaFieldDescriptor[] => {
    const fields: SchemaFieldDescriptor[] = [];

    for (const [key, value] of Object.entries(definition)) {
        if (value === null || value === undefined) continue;

        const currentPath = prefix ? `${prefix}.${key}` : key;

        if (typeof value === 'string') {
            fields.push({
                path: currentPath,
                name: key,
                type: value,
                isListing: false,
                isPerAtom: false,
                label: key,
                parentIsPerAtomArray: parentPerAtom
            });
            continue;
        }

        if (typeof value !== 'object') continue;
        const record = value as Record<string, unknown>;

        if (isArrayType(record)) {
            const isPerAtomArray = record.perAtom === true;

            fields.push({
                path: currentPath,
                name: key,
                type: 'array',
                isListing: record.listing === true,
                isPerAtom: isPerAtomArray,
                label: typeof record.label === 'string' ? record.label : key,
                parentIsPerAtomArray: parentPerAtom
            });

            if (record.items && typeof record.items === 'object' && !Array.isArray(record.items)) {
                fields.push(...collectSchemaFields(
                    record.items as Record<string, unknown>,
                    currentPath,
                    isPerAtomArray
                ));
            }
            continue;
        }

        if (isObjectType(record)) {
            fields.push({
                path: currentPath,
                name: key,
                type: 'object',
                isListing: record.listing === true,
                isPerAtom: false,
                label: typeof record.label === 'string' ? record.label : key,
                parentIsPerAtomArray: parentPerAtom
            });
            continue;
        }

        if (isPrimitive(record)) {
            fields.push({
                path: currentPath,
                name: key,
                type: typeof record.type === 'string' ? record.type : 'unknown',
                isListing: record.listing === true,
                isPerAtom: record.perAtom === true,
                label: typeof record.label === 'string' ? record.label : key,
                parentIsPerAtomArray: parentPerAtom
            });
            continue;
        }

        if (!record.type) {
            fields.push(...collectSchemaFields(record as Record<string, unknown>, currentPath, parentPerAtom));
        }
    }

    return fields;
};

export {
    parseSchemaAnnotations,
    applyAnnotation,
    removeAnnotation,
    collectSchemaFields
};

export type {
    ListingField,
    ListingFieldKind,
    ParsedSchemaAnnotations,
    SchemaFieldDescriptor
};
