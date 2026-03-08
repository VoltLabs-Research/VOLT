import { WorkflowNodeType, WorkflowNode } from '@modules/plugin/domain/entities/plugin/workflow/WorkflowNode';
import { INodeHandler, ExecutionContext, NodeOutputSchema, T } from '@modules/plugin/domain/port/plugin/INodeRegistry';

import { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class ModifierHandler implements INodeHandler{
    readonly type = WorkflowNodeType.Modifier;
    
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private trajectoryRepo: ITrajectoryRepository,
        
        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private analysisRepo: IAnalysisRepository
    ){}

    readonly outputSchema: NodeOutputSchema = {
        properties: {
            pluginId: T.string(),
            trajectory: T.object({}),
            analysis: T.object({})
        }
    };

    async execute(node: WorkflowNode, context: ExecutionContext): Promise<Record<string, any>>{
        const [trajectory, analysis] = await Promise.all([
            this.trajectoryRepo.findById(context.trajectoryId),
            this.analysisRepo.findById(context.analysisId)
        ]);

        return {
            ...node.data.modifier,
            pluginId: context.pluginId,
            trajectory: trajectory?.props,
            analysis: analysis?.props
        };
    }
};