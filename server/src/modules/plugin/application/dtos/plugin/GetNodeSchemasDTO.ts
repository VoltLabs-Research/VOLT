import type { NodeOutputSchema } from '@modules/plugin/domain/port/plugin/INodeRegistry';

export interface GetNodeSchemasOutputDTO {
    schemas: Record<string, NodeOutputSchema>;
};
