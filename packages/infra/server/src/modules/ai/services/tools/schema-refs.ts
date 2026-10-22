const REF = '$ref';

type SchemaNode = Record<string, unknown>;

interface DefinitionSource {
    prefix: string;
    container: string;
    of: (schema: SchemaNode) => unknown;
}

const SOURCES: DefinitionSource[] = [
    {
        prefix: '#/$defs/',
        container: '$defs',
        of: (schema) => schema.$defs
    },
    {
        prefix: '#/components/schemas/',
        container: 'components',
        of: (schema) => isNode(schema.components) ? schema.components.schemas : undefined
    }
];

const isNode = (value: unknown): value is SchemaNode =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const definitionsOf = (schema: SchemaNode): Map<string, unknown> => {
    const definitions = new Map<string, unknown>();

    for (const source of SOURCES) {
        const held = source.of(schema);
        if (!isNode(held)) continue;

        for (const [name, definition] of Object.entries(held)) definitions.set(`${source.prefix}${name}`, definition);
    }

    return definitions;
};

// Several providers reject JSON Schema references, so each one is inlined where it is used.
export const withoutRefs = (schema: unknown): unknown => {
    if (!isNode(schema)) return schema;

    const definitions = definitionsOf(schema);
    const containers = new Set(SOURCES.map((source) => source.container));

    const walk = (node: unknown, expanding: string[]): unknown => {
        if (Array.isArray(node)) return node.map((item) => walk(item, expanding));
        if (!isNode(node)) return node;

        const ref = node[REF];
        if (typeof ref === 'string' && definitions.has(ref) && !expanding.includes(ref)) {
            return walk(definitions.get(ref), [...expanding, ref]);
        }

        return Object.fromEntries(Object.entries(node).map(([field, value]) => [field, walk(value, expanding)]));
    };

    return walk(Object.fromEntries(Object.entries(schema).filter(([field]) => !containers.has(field))), []);
};
