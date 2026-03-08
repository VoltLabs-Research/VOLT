import { inject, injectable } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import { SCRIPTING_TOKENS } from '@modules/scripting/application/di/ScriptingTokens';
import type { IScriptingNotebookRepository } from '@modules/scripting/domain/port/IScriptingNotebookRepository';
import { SHARED_TOKENS } from '@shared/application/di/SharedTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
import NotebookDeletedEvent from '@modules/scripting/domain/events/NotebookDeletedEvent';
import { DeleteScriptingNotebookInputDTO, DeleteScriptingNotebookOutputDTO } from '@modules/scripting/application/dtos/DeleteScriptingNotebookDTO';

@injectable()
export class DeleteScriptingNotebookUseCase implements IUseCase<DeleteScriptingNotebookInputDTO, DeleteScriptingNotebookOutputDTO, ApplicationError> {
    constructor(
        @inject(SCRIPTING_TOKENS.ScriptingNotebookRepository)
        private readonly scriptingNotebookRepository: IScriptingNotebookRepository,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ) {}

    async execute(input: DeleteScriptingNotebookInputDTO): Promise<Result<DeleteScriptingNotebookOutputDTO, ApplicationError>> {
        try {
            const notebook = await this.scriptingNotebookRepository.findById(input.notebookId);
            if (!notebook) {
                return Result.fail(ApplicationError.notFound(
                    ErrorCodes.RESOURCE_NOT_FOUND,
                    'Notebook not found'
                ));
            }

            await this.scriptingNotebookRepository.deleteById(input.notebookId);

            await this.eventBus.publish(new NotebookDeletedEvent({
                notebookId: input.notebookId,
                teamId: input.teamId
            }));

            return Result.ok({ message: 'Notebook deleted successfully' });
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to delete notebook',
                500
            ));
        }
    }
}
