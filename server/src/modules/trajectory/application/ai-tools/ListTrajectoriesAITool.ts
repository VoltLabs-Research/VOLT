import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';
import type { AIToolScope } from '@modules/ai/application/services/AIToolService';
import GetTrajectoriesByTeamIdUseCase from '@modules/trajectory/application/use-cases/trajectory/GetTrajectoriesByTeamIdUseCase';

@injectable()
export class ListTrajectoriesAITool extends AITool {
    readonly name = 'list_trajectories';
    readonly description = 'List all trajectories in the selected team with their status, frames count, and dates.';
    readonly parameters = z.object({ page: z.number().optional().default(1), limit: z.number().optional().default(50) });

    constructor(
        @inject(GetTrajectoriesByTeamIdUseCase)
        protected readonly useCase: GetTrajectoriesByTeamIdUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.useCase.execute({ teamId: scope.teamId, page: params.page, limit: params.limit });
        if (!result.success) throw result.error;
        return {
            summary: `Found ${result.value.total} trajectories.`,
            data: result.value.data.map((t: any) => ({
                trajectoryId: t._id, name: t.name, status: t.status,
                framesCount: Array.isArray(t.frames) ? t.frames.length : 0,
                isPublic: t.isPublic, createdAt: t.createdAt ?? null
            })),
            total: result.value.total
        };
    }
}
