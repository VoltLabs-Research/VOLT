import { NodeType } from '@/models/plugin';
import { IWorkflowNode } from '@/types/models/modifier';
import { NodeHandler, ExecutionContext } from '@/services/nodes/node-registry';
import { T, NodeOutputSchema } from '@/services/nodes/schema-types';
import { Trajectory, Analysis } from '@/models';

class ModifierHandler implements NodeHandler{
    readonly type = NodeType.MODIFIER;

    readonly outputSchema: NodeOutputSchema = {
        properties: {
            pluginSlug: T.string('Plugin identifier'),
            trajectory: T.object({}, 'Trajectory document'),
            analysis: T.object({}, 'Analysis document')
        }
    };

    async execute(node: IWorkflowNode, context: ExecutionContext): Promise<Record<string, any>>{
        const data = node.data.modifier!;
        const [trajectory, analysis] = await Promise.all([
            Trajectory.findById(context.trajectoryId).lean(),
            Analysis.findById(context.analysisId).lean() 
        ]);

        return {
            ...data,
            pluginSlug: context.pluginSlug,
            trajectory,
            analysis
        }
    }
};

export default new ModifierHandler();