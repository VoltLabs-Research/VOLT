import type {
    CreateScriptingJupyterSessionInputDTO,
    CreateScriptingJupyterSessionOutputDTO
} from '@modules/scripting/application/dtos/CreateScriptingJupyterSessionDTO';
import type {
    CreateScriptingNotebookInputDTO,
    CreateScriptingNotebookOutputDTO
} from '@modules/scripting/application/dtos/CreateScriptingNotebookDTO';
import type {
    DeleteScriptingNotebookInputDTO,
    DeleteScriptingNotebookOutputDTO
} from '@modules/scripting/application/dtos/DeleteScriptingNotebookDTO';
import type {
    ListScriptingNotebooksInputDTO,
    ListScriptingNotebooksOutputDTO
} from '@modules/scripting/application/dtos/ListScriptingNotebooksDTO';
import type { ScriptingNotebookDTO } from '@modules/scripting/application/dtos/ScriptingNotebookDTO';
import type {
    DeleteScriptingSessionInputDTO,
    DeleteScriptingSessionOutputDTO,
    GetScriptingSessionStatusInputDTO,
    GetScriptingSessionStatusOutputDTO
} from '@modules/scripting/application/dtos/ScriptingSessionDTO';
import type { UpdateScriptingNotebookInputDTO } from '@modules/scripting/application/dtos/UpdateScriptingNotebookDTO';
import { CreateScriptingJupyterSessionUseCase } from '@modules/scripting/application/use-cases/CreateScriptingJupyterSessionUseCase';
import { CreateScriptingNotebookUseCase } from '@modules/scripting/application/use-cases/CreateScriptingNotebookUseCase';
import { DeleteScriptingNotebookUseCase } from '@modules/scripting/application/use-cases/DeleteScriptingNotebookUseCase';
import { DeleteScriptingSessionUseCase } from '@modules/scripting/application/use-cases/DeleteScriptingSessionUseCase';
import { GetScriptingSessionStatusUseCase } from '@modules/scripting/application/use-cases/GetScriptingSessionStatusUseCase';
import { ListScriptingNotebooksUseCase } from '@modules/scripting/application/use-cases/ListScriptingNotebooksUseCase';
import { UpdateScriptingNotebookUseCase } from '@modules/scripting/application/use-cases/UpdateScriptingNotebookUseCase';
import { SCRIPTING_TOKENS } from '@modules/scripting/infrastructure/di/ScriptingTokens';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

/**
 * The single application service for the scripting module. Each method delegates
 * to its retained use case, unwrapping the Result error channel onto thrown
 * `ApplicationError`s so Express 5 forwards them to the global error middleware.
 * Every use case is retained because each is still consumed by a scripting AI
 * tool (and `DeleteScriptingNotebookUseCase` is additionally consumed by the
 * team-deleted event handler), mirroring the auth module's `updateAccount`
 * delegator.
 */
@Singleton(SCRIPTING_TOKENS.ScriptingService)
export default class ScriptingService {
    constructor(
        @inject(CreateScriptingJupyterSessionUseCase) private readonly createScriptingJupyterSessionUseCase: CreateScriptingJupyterSessionUseCase,
        @inject(CreateScriptingNotebookUseCase) private readonly createScriptingNotebookUseCase: CreateScriptingNotebookUseCase,
        @inject(DeleteScriptingNotebookUseCase) private readonly deleteScriptingNotebookUseCase: DeleteScriptingNotebookUseCase,
        @inject(DeleteScriptingSessionUseCase) private readonly deleteScriptingSessionUseCase: DeleteScriptingSessionUseCase,
        @inject(GetScriptingSessionStatusUseCase) private readonly getScriptingSessionStatusUseCase: GetScriptingSessionStatusUseCase,
        @inject(ListScriptingNotebooksUseCase) private readonly listScriptingNotebooksUseCase: ListScriptingNotebooksUseCase,
        @inject(UpdateScriptingNotebookUseCase) private readonly updateScriptingNotebookUseCase: UpdateScriptingNotebookUseCase
    ) {}

    async createJupyterSession(input: CreateScriptingJupyterSessionInputDTO): Promise<CreateScriptingJupyterSessionOutputDTO> {
        const result = await this.createScriptingJupyterSessionUseCase.execute(input);
        if (!result.success) {
            throw result.error;
        }

        return result.value;
    }

    async createNotebook(input: CreateScriptingNotebookInputDTO): Promise<CreateScriptingNotebookOutputDTO> {
        const result = await this.createScriptingNotebookUseCase.execute(input);
        if (!result.success) {
            throw result.error;
        }

        return result.value;
    }

    async deleteNotebook(input: DeleteScriptingNotebookInputDTO): Promise<DeleteScriptingNotebookOutputDTO> {
        const result = await this.deleteScriptingNotebookUseCase.execute(input);
        if (!result.success) {
            throw result.error;
        }

        return result.value;
    }

    async deleteSession(input: DeleteScriptingSessionInputDTO): Promise<DeleteScriptingSessionOutputDTO> {
        const result = await this.deleteScriptingSessionUseCase.execute(input);
        if (!result.success) {
            throw result.error;
        }

        return result.value;
    }

    async getSessionStatus(input: GetScriptingSessionStatusInputDTO): Promise<GetScriptingSessionStatusOutputDTO> {
        const result = await this.getScriptingSessionStatusUseCase.execute(input);
        if (!result.success) {
            throw result.error;
        }

        return result.value;
    }

    async listNotebooks(input: ListScriptingNotebooksInputDTO): Promise<ListScriptingNotebooksOutputDTO> {
        const result = await this.listScriptingNotebooksUseCase.execute(input);
        if (!result.success) {
            throw result.error;
        }

        return result.value;
    }

    async updateNotebook(input: UpdateScriptingNotebookInputDTO): Promise<ScriptingNotebookDTO> {
        const result = await this.updateScriptingNotebookUseCase.execute(input);
        if (!result.success) {
            throw result.error;
        }

        return result.value;
    }
}
