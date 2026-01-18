import { inject, injectable } from 'tsyringe';
import { INodeHandler, ExecutionContext, NodeOutputSchema, T } from '@modules/plugin/domain/ports/INodeRegistry';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { ITrajectoryDumpStorageService } from '@modules/trajectory/domain/port/ITrajectoryDumpStorageService';
import { ITrajectoryRepository } from '@modules/trajectory/domain/port/ITrajectoryRepository';
import { WorkflowNodeType, WorkflowNode } from '@modules/plugin/domain/entities/workflow/WorkflowNode';
import { ContextSource } from '@modules/plugin/domain/entities/workflow/nodes/ContextNode';

@injectable()
export default class ContextHandler implements INodeHandler{
    readonly type = WorkflowNodeType.Context;

    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryDumpStorageService)
        private dumpStorage: ITrajectoryDumpStorageService,
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private trajectoryRepo: ITrajectoryRepository
    ){}

    readonly outputSchema: NodeOutputSchema = {
        properties: {
            trajectory_dumps: T.array(T.object({
                path: T.string(),
                frame: T.number()
            })),
            count: T.number(),
            trajectory: T.object({})
        }
    };

    async execute(node: WorkflowNode, context: ExecutionContext): Promise<Record<string, any>>{
        const source = node.data.context?.source;
        if(source !== ContextSource.TrajectoryDumps){
            throw new Error(`ContextHandler: Unknown source '${source}'`);
        }

        const [allTimesteps, trajectory] = await Promise.all([
            this.dumpStorage.listDumps(context.trajectoryId),
            this.trajectoryRepo.findById(context.trajectoryId)
        ]);

        // Filter: If "Selected Frame Only" is active, narrow down to that specific frame
        const timestepsToProcess = (context.selectedFrameOnly && context.selectedTimestep !== undefined)
            ? allTimesteps.filter((timestep) => timestep === String(context.selectedTimestep))
            : allTimesteps;
        
        // Map to structured objects in parallel
        const trajectory_dumps = await Promise.all(
            timestepsToProcess.map(async (timestep) => ({
                path: await this.dumpStorage.getDump(context.trajectoryId, timestep),
                frame: Number(timestep)
            }))
        );

        return {
            trajectory_dumps: trajectory_dumps.filter((dump) => dump.path !== null),
            count: trajectory_dumps.length,
            trajectory
        };
    }
};