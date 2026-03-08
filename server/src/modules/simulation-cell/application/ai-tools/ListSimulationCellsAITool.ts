import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';
import type { AIToolScope } from '@modules/ai/application/services/AIToolService';
import ListSimulationCellsByTeamIdUseCase from '@modules/simulation-cell/application/use-cases/ListSimulationCellsByTeamIdUseCase';
import { SIMULATION_CELL_TOKENS } from '@modules/simulation-cell/infrastructure/di/SimulationCellTokens';

@injectable()
export class ListSimulationCellsAITool extends AITool {
    readonly name = 'list_simulation_cells';
    readonly description = 'List all simulation cells in the selected team.';
    readonly parameters = z.object({ page: z.number().optional().default(1), limit: z.number().optional().default(50) });

    constructor(
        @inject(SIMULATION_CELL_TOKENS.ListSimulationCellsByTeamIdUseCase)
        protected readonly useCase: ListSimulationCellsByTeamIdUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.useCase.execute({ teamId: scope.teamId, page: params.page, limit: params.limit });
        if (!result.success) throw result.error;
        return {
            summary: `Found ${result.value.total} simulation cells.`,
            data: result.value.data.map((cell) => ({
                cellId: cell._id,
                timestep: cell.timestep,
                trajectory: typeof cell.trajectory === 'string' ? cell.trajectory : (cell.trajectory?.name || ''),
                boundingBox: cell.boundingBox ? `${cell.boundingBox.width}x${cell.boundingBox.height}x${cell.boundingBox.length}` : '',
                createdAt: cell.createdAt ?? null
            })),
            total: result.value.total
        };
    }
}
