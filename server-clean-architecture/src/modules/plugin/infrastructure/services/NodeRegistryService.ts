import { injectable } from 'tsyringe';

@injectable()
export class NodeRegistryService {
    private schemas: Record<string, any> = {
        'modifier': {
            type: 'modifier',
            inputs: ['atoms'],
            outputs: ['result'],
            properties: ['name', 'description']
        },
        'filter': {
            type: 'filter',
            inputs: ['atoms'],
            outputs: ['filtered'],
            properties: ['expression', 'mode']
        },
        'colorCoding': {
            type: 'colorCoding',
            inputs: ['atoms'],
            outputs: ['colored'],
            properties: ['scheme', 'property', 'range']
        },
        'output': {
            type: 'output',
            inputs: ['data'],
            outputs: [],
            properties: ['format', 'path']
        }
    };

    getAllSchemas(): Record<string, any> {
        return this.schemas;
    }

    getSchema(type: string): any | null {
        return this.schemas[type] || null;
    }

    registerSchema(type: string, schema: any): void {
        this.schemas[type] = schema;
    }
}
