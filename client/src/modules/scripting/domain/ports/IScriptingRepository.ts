import type {
    ListScriptingNotebooksInputDTO,
    ListScriptingNotebooksOutputDTO,
    CreateScriptingJupyterSessionInputDTO,
    CreateScriptingJupyterSessionOutputDTO
} from '@/modules/scripting/application/dtos';

export default interface IScriptingRepository {
    listScriptingNotebooks(input: ListScriptingNotebooksInputDTO): Promise<ListScriptingNotebooksOutputDTO>;
    createScriptingJupyterSession(input: CreateScriptingJupyterSessionInputDTO): Promise<CreateScriptingJupyterSessionOutputDTO>;
    deleteScriptingNotebook(notebookId: string): Promise<void>;
}
