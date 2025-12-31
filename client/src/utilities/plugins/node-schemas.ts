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