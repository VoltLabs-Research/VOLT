import { injectable } from 'tsyringe';
import BaseRepository, { ApiResponse } from '@/shared/infrastructure/repositories/BaseRepository';
import type IScriptingRepository from '@/modules/scripting/domain/port/IScriptingRepository';
import type {
    ListScriptingNotebooksInputDTO,
    ListScriptingNotebooksOutputDTO,
    CreateScriptingJupyterSessionInputDTO,
    CreateScriptingJupyterSessionOutputDTO
} from '@/modules/scripting/application/dtos';

@injectable()
export default class ScriptingRepository extends BaseRepository implements IScriptingRepository {
    constructor() {
        super('/plugin', { useRBAC: true });
    }

    async listScriptingNotebooks(input: ListScriptingNotebooksInputDTO): Promise<ListScriptingNotebooksOutputDTO> {
        const { trajectoryId, page, limit } = input;
        const url = trajectoryId ? `/scripting/${trajectoryId}/notebooks` : '/scripting/notebooks';
        return this.getAllPaginated(url, { page, limit });
    }

    async createScriptingJupyterSession(
        input: CreateScriptingJupyterSessionInputDTO
    ): Promise<CreateScriptingJupyterSessionOutputDTO> {
        const { trajectoryId, ...body } = input;
        const response = await this.client.request<ApiResponse<CreateScriptingJupyterSessionOutputDTO>>(
            'POST',
            `/scripting/${trajectoryId}/jupyter-session`,
            { body }
        );
        return this.unwrap(response);
    }

    async deleteScriptingNotebook(notebookId: string): Promise<void> {
        await this.client.delete(`/scripting/notebooks/${notebookId}`);
    }
}
