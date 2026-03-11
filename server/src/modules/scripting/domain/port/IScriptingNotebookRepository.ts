import type {
    IBaseRepository,
    PaginatedResult,
    PaginationOptions
} from '@shared/domain/port/IBaseRepository';
import type { ScriptingNotebookProps } from '@modules/scripting/domain/entities/ScriptingNotebook';
import type { ScriptingNotebookScope } from '@modules/scripting/domain/entities/ScriptingNotebookScope';
import type ScriptingNotebook from '@modules/scripting/domain/entities/ScriptingNotebook';

export interface ListScriptingNotebookFilters {
    trajectoryId?: string;
    scope?: ScriptingNotebookScope;
};

export interface IScriptingNotebookRepository extends IBaseRepository<ScriptingNotebook, ScriptingNotebookProps> {
    findByTeamAndNotebookId(teamId: string, notebookId: string): Promise<ScriptingNotebook | null>;
    findByTeamAndTrajectory(teamId: string, trajectoryId: string): Promise<ScriptingNotebook | null>;
    findAllByTeam(
        teamId: string,
        options: PaginationOptions,
        filters?: ListScriptingNotebookFilters
    ): Promise<PaginatedResult<ScriptingNotebook>>;
    findAllWithTrajectory(trajectoryId: string): Promise<ScriptingNotebook[]>;
    removeTrajectory(trajectoryId: string): Promise<void>;
};
