import { AITool } from '@shared/application/ai/AITool';
import { SIMULATION_CELL_TOKENS } from '@modules/simulation-cell/infrastructure/di/SimulationCellTokens';
import ListSimulationCellsByTeamIdUseCase from '@modules/simulation-cell/application/use-cases/ListSimulationCellsByTeamIdUseCase';
import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import type { AIToolScope } from '@modules/ai/infrastructure/services/AIToolService';

@injectable()
export class ListSimulationCellsAITool extends AITool {
    readonly name = 'list_simulation_cells';
    readonly description = 'List all simulation cells in the selected team.';
    readonly parameters = z.object({
        page: z.number().optional().default(1),
        limit: z.number().optional().default(50)
    });

    constructor(
        @inject(SIMULATION_CELL_TOKENS.ListSimulationCellsByTeamIdUseCase)
        protected readonly useCase: ListSimulationCellsByTeamIdUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.useCase.execute({
            teamId: scope.teamId,
            page: params.page,
            limit: params.limit
        });

        if (!result.success) throw result.error;

        return {
            summary: `Found ${result.value.total} simulation cells.`,
            data: result.value.data.map((cell) => {
                let trajectory = '';
                let boundingBox = '';

                if (typeof cell.trajectory === 'string') {
                    trajectory = cell.trajectory;
                } else if (cell.trajectory?.name) {
                    trajectory = cell.trajectory.name;
                }

                if (cell.boundingBox) {
                    boundingBox = `${cell.boundingBox.width}x${cell.boundingBox.height}x${cell.boundingBox.length}`;
                }

                return {
                    cellId: cell._id,
                    timestep: cell.timestep,
                    trajectory,
                    boundingBox,
                    createdAt: cell.createdAt ?? null
                };
            }),
            total: result.value.total
        };
    }
};
