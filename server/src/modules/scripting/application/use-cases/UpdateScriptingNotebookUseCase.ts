import { toScriptingNotebookDTO } from '@modules/scripting/application/utilities/to-scripting-notebook-dto';
import { SCRIPTING_TOKENS } from '@modules/scripting/infrastructure/di/ScriptingTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';
import type {
    UpdateScriptingNotebookInputDTO,
    UpdateScriptingNotebookOutputDTO
} from '@modules/scripting/application/dtos/UpdateScriptingNotebookDTO';
import type { IUseCase } from '@shared/application/IUseCase';
import type { IScriptingNotebookRepository } from '@modules/scripting/domain/port/IScriptingNotebookRepository';

@injectable()
export class UpdateScriptingNotebookUseCase implements IUseCase<UpdateScriptingNotebookInputDTO, UpdateScriptingNotebookOutputDTO, ApplicationError> {
    constructor(
        @inject(SCRIPTING_TOKENS.ScriptingNotebookRepository)
        private readonly scriptingNotebookRepository: IScriptingNotebookRepository
    ) {}

    async execute(input: UpdateScriptingNotebookInputDTO): Promise<Result<UpdateScriptingNotebookOutputDTO, ApplicationError>> {
        try {
            const existing = await this.scriptingNotebookRepository.findByTeamAndNotebookId(
                input.teamId,
                input.notebookId
            );

            if (!existing) {
                return Result.fail(ApplicationError.notFound(
                    ErrorCodes.RESOURCE_NOT_FOUND,
                    'Notebook not found'
                ));
            }

            const updated = await this.scriptingNotebookRepository.updateById(input.notebookId, {
                title: input.title.trim(),
                updatedAt: new Date()
            });

            if (!updated) {
                return Result.fail(ApplicationError.notFound(
                    ErrorCodes.RESOURCE_NOT_FOUND,
                    'Notebook not found'
                ));
            }

            return Result.ok(toScriptingNotebookDTO(updated));
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to update notebook',
                500
            ));
        }
    }
};
