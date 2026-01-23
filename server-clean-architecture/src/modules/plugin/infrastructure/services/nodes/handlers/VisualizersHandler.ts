import { injectable } from 'tsyringe';
import { INodeHandler, ExecutionContext, NodeOutputSchema, T } from '@modules/plugin/domain/ports/INodeRegistry';
import { WorkflowNodeType, WorkflowNode } from '@modules/plugin/domain/entities/workflow/WorkflowNode';

@injectable()
export default class VisualizersHandler implements INodeHandler {
    readonly type = WorkflowNodeType.Visualizers;

    readonly outputSchema: NodeOutputSchema = {
        properties: {
            canvas: T.boolean('Whether canvas visualization is enabled'),
            raster: T.boolean('Whether raster visualization is enabled'),
            listingTitle: T.string('Title for the listing'),
            listing: T.object({}, 'Listing configuration'),
            perAtomProperties: T.array(T.string(), 'Per-atom properties to visualize')
        }
    };

    async execute(node: WorkflowNode, _context: ExecutionContext): Promise<Record<string, any>> {
        const config = node.data.visualizers || {};

        return {
            canvas: config.canvas ?? false,
            raster: config.raster ?? false,
            listingTitle: config.listingTitle,
            listing: config.listing || {},
            perAtomProperties: config.perAtomProperties || []
        };
    }
};
