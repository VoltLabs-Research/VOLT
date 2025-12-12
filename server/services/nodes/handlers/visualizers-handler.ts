import { NodeType } from '@/models/plugin';
import { IWorkflowNode } from '@/types/models/modifier';
import { NodeHandler, ExecutionContext } from '@/services/nodes/node-registry';
import { T, NodeOutputSchema } from '@/services/nodes/schema-types';

class VisualizersHandler implements NodeHandler{
    readonly type = NodeType.VISUALIZERS;

    readonly outputSchema: NodeOutputSchema = {
        properties: {
            canvas: T.boolean('Enable 3D canvas'),
            raster: T.boolean('Enable raster view'),
            listing: T.object({}, 'Listing configuration')
        }
    };

    async execute(node: IWorkflowNode): Promise<Record<string, any>>{
        const config = node.data.visualizers!;
        return {
            canvas: config.canvas ?? false,
            raster: config.raster ?? false,
            listing: config.listing ?? {}
        };
    }
};

export default new VisualizersHandler();