import { inject, injectable } from 'tsyringe';
import { WorkflowNodeType, WorkflowNode } from '@/src/modules/plugin/domain/entities/workflow/WorkflowNode';
import { INodeHandler, ExecutionContext, NodeOutputSchema, T } from '@/src/modules/plugin/domain/ports/INodeRegistry';
import { ITrajectoryRepository } from '@/src/modules/trajectory/domain/port/ITrajectoryRepository';
import { IAnalysisRepository } from '@/src/modules/analysis/domain/port/IAnalysisRepository';
import { TRAJECTORY_TOKENS } from '@/src/modules/trajectory/infrastructure/di/TrajectoryTokens';
import { ANALYSIS_TOKENS } from '@/src/modules/analysis/infrastructure/di/AnalysisTokens';

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
            pluginSlug: T.string(),
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
            pluginSlug: context.pluginSlug,
            trajectory: trajectory?.props,
            analysis: analysis?.props
        };
    }
};