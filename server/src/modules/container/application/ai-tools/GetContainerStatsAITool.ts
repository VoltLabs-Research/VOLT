import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';
import { GetContainerStatsUseCase } from '@modules/container/application/use-cases/GetContainerStatsUseCase';

@injectable()
export class GetContainerStatsAITool extends AITool {
    readonly name = 'get_container_stats';
    readonly description = 'Get resource usage stats for a container.';
    readonly parameters = z.object({ containerId: z.string() });

    constructor(
        @inject(GetContainerStatsUseCase)
        protected readonly useCase: GetContainerStatsUseCase
    ) {
        super();
    }
}
