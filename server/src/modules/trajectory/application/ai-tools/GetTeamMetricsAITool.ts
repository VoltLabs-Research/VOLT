import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';
import GetTeamMetricsUseCase from '@modules/trajectory/application/use-cases/trajectory/GetTeamMetricsUseCase';

@injectable()
export class GetTeamMetricsAITool extends AITool {
    readonly name = 'get_team_metrics';
    readonly description = 'Get trajectory and analysis metrics for the selected team.';
    readonly parameters = z.object({});

    constructor(
        @inject(GetTeamMetricsUseCase)
        protected readonly useCase: GetTeamMetricsUseCase
    ) {
        super();
    }
}
