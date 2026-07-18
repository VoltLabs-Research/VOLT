import type {
    CreateScriptingJupyterSessionInputDTO,
    CreateScriptingJupyterSessionOutputDTO
} from '@modules/scripting/dtos/CreateScriptingJupyterSessionDTO';
import type {
    CreateScriptingNotebookInputDTO,
    CreateScriptingNotebookOutputDTO
} from '@modules/scripting/dtos/CreateScriptingNotebookDTO';
import type {
    DeleteScriptingNotebookInputDTO,
    DeleteScriptingNotebookOutputDTO
} from '@modules/scripting/dtos/DeleteScriptingNotebookDTO';
import type {
    ListScriptingNotebooksInputDTO,
    ListScriptingNotebooksOutputDTO
} from '@modules/scripting/dtos/ListScriptingNotebooksDTO';
import type { ScriptingNotebookDTO } from '@modules/scripting/dtos/ScriptingNotebookDTO';
import type {
    DeleteScriptingSessionInputDTO,
    DeleteScriptingSessionOutputDTO,
    GetScriptingSessionStatusInputDTO,
    GetScriptingSessionStatusOutputDTO
} from '@modules/scripting/dtos/ScriptingSessionDTO';
import type { UpdateScriptingNotebookInputDTO } from '@modules/scripting/dtos/UpdateScriptingNotebookDTO';
import { CreateScriptingJupyterSessionUseCase } from '@modules/scripting/use-cases/CreateScriptingJupyterSessionUseCase';
import { CreateScriptingNotebookUseCase } from '@modules/scripting/use-cases/CreateScriptingNotebookUseCase';
import { DeleteScriptingNotebookUseCase } from '@modules/scripting/use-cases/DeleteScriptingNotebookUseCase';
import { DeleteScriptingSessionUseCase } from '@modules/scripting/use-cases/DeleteScriptingSessionUseCase';
import { GetScriptingSessionStatusUseCase } from '@modules/scripting/use-cases/GetScriptingSessionStatusUseCase';
import { ListScriptingNotebooksUseCase } from '@modules/scripting/use-cases/ListScriptingNotebooksUseCase';
import { UpdateScriptingNotebookUseCase } from '@modules/scripting/use-cases/UpdateScriptingNotebookUseCase';
import { SCRIPTING_TOKENS } from '@modules/scripting/di/ScriptingTokens';
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
        return this.createScriptingJupyterSessionUseCase.execute(input);
    }

    async createNotebook(input: CreateScriptingNotebookInputDTO): Promise<CreateScriptingNotebookOutputDTO> {
        return this.createScriptingNotebookUseCase.execute(input);
    }

    async deleteNotebook(input: DeleteScriptingNotebookInputDTO): Promise<DeleteScriptingNotebookOutputDTO> {
        return this.deleteScriptingNotebookUseCase.execute(input);
    }

    async deleteSession(input: DeleteScriptingSessionInputDTO): Promise<DeleteScriptingSessionOutputDTO> {
        return this.deleteScriptingSessionUseCase.execute(input);
    }

    async getSessionStatus(input: GetScriptingSessionStatusInputDTO): Promise<GetScriptingSessionStatusOutputDTO> {
        return this.getScriptingSessionStatusUseCase.execute(input);
    }

    async listNotebooks(input: ListScriptingNotebooksInputDTO): Promise<ListScriptingNotebooksOutputDTO> {
        return this.listScriptingNotebooksUseCase.execute(input);
    }

    async updateNotebook(input: UpdateScriptingNotebookInputDTO): Promise<ScriptingNotebookDTO> {
        return this.updateScriptingNotebookUseCase.execute(input);
    }
}
