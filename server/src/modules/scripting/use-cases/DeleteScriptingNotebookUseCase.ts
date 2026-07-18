import { SCRIPTING_TOKENS } from '@modules/scripting/di/ScriptingTokens';
import type { IScriptingNotebookRepository } from '@modules/scripting/ports/IScriptingNotebookRepository';
import type { INotebookCredentialService } from '@modules/scripting/ports/INotebookCredentialService';
import { ErrorCodes } from '@core/constants/error-codes';
import { DeleteScriptingNotebookInputDTO, DeleteScriptingNotebookOutputDTO } from '@modules/scripting/dtos/DeleteScriptingNotebookDTO';
import NotebookDeletedEvent from '@modules/scripting/events/NotebookDeletedEvent';
import type { INotebookRuntimeTerminator } from '@modules/scripting/ports/INotebookRuntimeTerminator';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IEventBus } from '@shared/application/events/IEventBus';
import type { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject } from 'tsyringe';

@Singleton()
export class DeleteScriptingNotebookUseCase implements IUseCase<DeleteScriptingNotebookInputDTO, DeleteScriptingNotebookOutputDTO> {
    constructor(
        @inject(SCRIPTING_TOKENS.ScriptingNotebookRepository) private readonly scriptingNotebookRepository: IScriptingNotebookRepository,
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus,
        @inject(SCRIPTING_TOKENS.NotebookCredentialService) private readonly notebookCredentialService: INotebookCredentialService,
        @inject(SCRIPTING_TOKENS.NotebookRuntimeTerminator) private readonly notebookRuntimeTerminator: INotebookRuntimeTerminator
    ) {}

    async execute(input: DeleteScriptingNotebookInputDTO): Promise<DeleteScriptingNotebookOutputDTO> {
        try {
            const notebook = await this.scriptingNotebookRepository.findById(input.notebookId);
            if (!notebook) {
                throw ApplicationError.notFound(
                    ErrorCodes.RESOURCE_NOT_FOUND,
                    'Notebook not found'
                );
            }

            if (notebook.props.teamCluster && notebook.props.runtimeNotebookId) {
                await this.notebookRuntimeTerminator.terminate(
                    notebook.props.teamCluster,
                    notebook.props.runtimeNotebookId
                );
            }

            await this.notebookCredentialService.revokeSecretKey(notebook);

            await this.scriptingNotebookRepository.deleteById(input.notebookId);

            await this.eventBus.publish(new NotebookDeletedEvent({
                notebookId: input.notebookId,
                teamId: input.teamId
            }));

            return null;
        } catch (error) {
            if (error instanceof ApplicationError) {
                throw error;
            }

            throw new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to delete notebook',
                500
            );
        }
    }
}
