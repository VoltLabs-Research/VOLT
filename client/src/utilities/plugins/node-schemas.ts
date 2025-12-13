export type SchemaPropertyType = 'string' | 'number' | 'boolean' | 'array' | 'object' | 'any';

export interface SchemaProperty{
    type: SchemaPropertyType;
    description?: string;
    items?: SchemaProperty;
    properties?: Record<string, SchemaProperty>;
};

export interface NodeOutputSchema{
    properties: Record<string, SchemaProperty>;
};

export interface AutocompletePath{
    path: string;
    description?: string;
};

export interface NodeSchema{
    path: string;
    nodeId: string;
    nodeType: string;
    description?: string;
};

/**
 * Flatten schema to autocomplete paths
 */
export const flattenSchema = (schema: NodeOutputSchema, nodeId: string, maxDepth = 4): AutocompletePath[] => {
    const paths: AutocompletePath[] = [];

    const traverse = (props: Record<string, SchemaProperty>, prefix: string, depth: number) => {
        if(depth > maxDepth) return;
        for(const [key, prop] of Object.entries(props)){
            const fullPath = `${prefix}.${key}`;
            paths.push({
                path: fullPath,
                description: prop.description
            });

            if(prop.type === 'object' && prop.properties){
                traverse(prop.properties, fullPath, depth + 1);
            }

            if(prop.type === 'array' && prop.items?.properties){
                traverse(prop.items.properties, `${fullPath}[0]`, depth + 1);
            }
        }
    };

    traverse(schema.properties, nodeId, 0);
    return paths;
};

/**
 * Flatten all schemas for all nodes
 */
export const getAllAutocompletePaths = (
    nodes: Array<{ id: string; type: string }>,
    schemas: Record<string, NodeOutputSchema>
): NodeSchema[] => {
    const suggestions: NodeSchema[] = [];
    for(const node of nodes){
        const schema = schemas[node.type];
        if(!schema) continue;
        const paths = flattenSchema(schema, node.id);
        for(const { path, description } of paths){
            suggestions.push({
                path,
                nodeId: node.id,
                nodeType: node.type,
                description
            });
        }
    }
    return suggestions;
};
