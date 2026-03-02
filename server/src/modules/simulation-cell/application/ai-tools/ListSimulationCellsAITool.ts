import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';
import type { AIToolScope } from '@modules/ai/application/services/AIToolService';
import FindCellsByTeamIdUseCase from '@modules/simulation-cell/application/use-cases/FindCellsByTeamIdUseCase';

@injectable()
export class ListSimulationCellsAITool extends AITool {
    readonly name = 'list_simulation_cells';
    readonly description = 'List all simulation cells in the selected team.';
    readonly parameters = z.object({ page: z.number().optional().default(1), limit: z.number().optional().default(50) });

    constructor(
        @inject(FindCellsByTeamIdUseCase)
        protected readonly useCase: FindCellsByTeamIdUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.useCase.execute({ teamId: scope.teamId, page: params.page, limit: params.limit });
        if (!result.success) throw result.error;
        return {
            summary: `Found ${result.value.total} simulation cells.`,
            data: result.value.data.map((cell: any) => ({
                cellId: cell.id, timestep: cell.props.timestep,
                trajectory: typeof cell.props.trajectory === 'string' ? cell.props.trajectory : (cell.props.trajectory?.name || ''),
                boundingBox: cell.props.boundingBox ? `${cell.props.boundingBox.width}x${cell.props.boundingBox.height}x${cell.props.boundingBox.length}` : '',
                createdAt: cell.props.createdAt ?? null
            })),
            total: result.value.total
        };
    }
}
