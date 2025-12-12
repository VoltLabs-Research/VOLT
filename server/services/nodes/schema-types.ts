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

// helper to create schema properties
export const T = {
    string: (description?: string): SchemaProperty => ({ type: 'string', description }),
    number: (description?: string): SchemaProperty => ({ type: 'number', description }),
    boolean: (description?: string): SchemaProperty => ({ type: 'boolean', description }),
    any: (description?: string): SchemaProperty => ({ type: 'any', description }),
    array: (items: SchemaProperty, description?: string): SchemaProperty => ({  type: 'array', items, description }),
    object: (properties: Record<string, SchemaProperty>, description?: string): SchemaProperty => ({ type: 'object', properties, description })
};