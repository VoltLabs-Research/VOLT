import { inject, injectable } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import { SCRIPTING_TOKENS } from '@modules/scripting/infrastructure/di/ScriptingTokens';
import type { IScriptingNotebookRepository } from '@modules/scripting/domain/ports/IScriptingNotebookRepository';

interface DeleteScriptingNotebookInput {
    notebookId: string;
    teamId: string;
}

interface DeleteScriptingNotebookOutput {
    message: string;
}

@injectable()
export class DeleteScriptingNotebookUseCase implements IUseCase<DeleteScriptingNotebookInput, DeleteScriptingNotebookOutput, ApplicationError> {
    constructor(
        @inject(SCRIPTING_TOKENS.ScriptingNotebookRepository)
        private readonly scriptingNotebookRepository: IScriptingNotebookRepository
    ) {}

    async execute(input: DeleteScriptingNotebookInput): Promise<Result<DeleteScriptingNotebookOutput, ApplicationError>> {
        const notebook = await this.scriptingNotebookRepository.findById(input.notebookId);
        if (!notebook) {
            throw new ApplicationError(ErrorCodes.RESOURCE_NOT_FOUND, 'Notebook not found', 404);
        }

        await this.scriptingNotebookRepository.deleteById(input.notebookId);

        return Result.ok({ message: 'Notebook deleted successfully' });
    }
}
