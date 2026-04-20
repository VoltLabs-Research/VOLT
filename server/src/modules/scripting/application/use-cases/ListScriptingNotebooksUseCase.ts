import { CLUSTER_POPULATE, TRAJECTORY_POPULATE, USER_POPULATE } from '@shared/application/PopulatePresets';
import { toScriptingNotebookDTO } from '@modules/scripting/application/utilities/to-scripting-notebook-dto';
import {
    ListScriptingNotebooksInputDTO,
    ListScriptingNotebooksOutputDTO
} from '@modules/scripting/application/dtos/ListScriptingNotebooksDTO';
import { SCRIPTING_TOKENS } from '@modules/scripting/infrastructure/di/ScriptingTokens';
import { ScriptingNotebookScope } from '@modules/scripting/domain/entities/ScriptingNotebookScope';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { inject, injectable } from 'tsyringe';
import type { IUseCase } from '@shared/application/IUseCase';
import type { IScriptingNotebookRepository } from '@modules/scripting/domain/port/IScriptingNotebookRepository';

@injectable()
export class ListScriptingNotebooksUseCase implements IUseCase<ListScriptingNotebooksInputDTO, ListScriptingNotebooksOutputDTO, ApplicationError> {
    constructor(
        @inject(SCRIPTING_TOKENS.ScriptingNotebookRepository)
        private readonly scriptingNotebookRepository: IScriptingNotebookRepository
    ) {}

    async execute(input: ListScriptingNotebooksInputDTO): Promise<Result<ListScriptingNotebooksOutputDTO, ApplicationError>> {
        const page = Math.max(1, input.page ?? 1);
        const limit = Math.max(1, Math.min(500, input.limit ?? 500));
        const filter: Record<string, unknown> = { team: input.teamId };

        if (input.trajectoryId) {
            filter.trajectory = input.trajectoryId;
        } else if (input.scope === ScriptingNotebookScope.General) {
            filter.$or = [
                { trajectory: null },
                { trajectory: { $exists: false } }
            ];
        } else if (input.scope === ScriptingNotebookScope.Trajectory) {
            filter.trajectory = {
                $exists: true,
                $ne: null
            };
        }

        const result = await this.scriptingNotebookRepository.findAll({
            filter,
            page,
            limit,
            sort: { updatedAt: -1 },
            populate: [
                CLUSTER_POPULATE,
                TRAJECTORY_POPULATE,
                USER_POPULATE
            ]
        });

        return Result.ok({
            ...result,
            data: result.data.map(toScriptingNotebookDTO)
        });
    }
};
