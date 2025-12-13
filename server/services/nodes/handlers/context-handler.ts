import { NodeType, ModifierContext } from '@/types/models/plugin';
import { IWorkflowNode } from '@/types/models/modifier';
import { NodeHandler, ExecutionContext } from '@/services/nodes/node-registry';
import { T, NodeOutputSchema } from '@/services/nodes/schema-types';
import { Trajectory } from '@/models';
import DumpStorage from '@/services/dump-storage';

class ContextHandler implements NodeHandler{
    readonly type = NodeType.CONTEXT;

    readonly outputSchema: NodeOutputSchema = {
        properties: {
            trajectory_dumps: T.array(T.object({
                path: T.string('Path to dump file'),
                frame: T.number('Frame/timestep number')
            }), 'Array of trajectory dumps'),
            count: T.number('Number of dumps'),
            trajectory: T.object({}, 'Trajectory document')
        }
    };

    async execute(node: IWorkflowNode, context: ExecutionContext): Promise<Record<string, any>>{
        const source = node.data.context?.source;

        if(source === ModifierContext.TRAJECTORY_DUMPS){
            const timesteps = await DumpStorage.listDumps(context.trajectoryId);
            const trajectory = await Trajectory.findById(context.trajectoryId).lean();

            const dumpPromises = timesteps.map(async(timestep) => {
                const dumpPath = await DumpStorage.getDump(context.trajectoryId, timestep);
                return { path: dumpPath, frame: parseInt(timestep, 10) };
            });

            const trajectory_dumps = await Promise.all(dumpPromises);
            return {
                trajectory_dumps,
                count: trajectory_dumps.length,
                trajectory
            };
        }

        throw new Error(`Unknown context source: ${source}`);
    }
};

export default new ContextHandler();
