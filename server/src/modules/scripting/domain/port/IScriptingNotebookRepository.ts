import type {
    IBaseRepository,
    PaginatedResult,
    PaginationOptions
} from '@shared/domain/port/IBaseRepository';
import type { ScriptingNotebookProps } from '@modules/scripting/domain/entities/ScriptingNotebook';
import type ScriptingNotebook from '@modules/scripting/domain/entities/ScriptingNotebook';

export interface IScriptingNotebookRepository extends IBaseRepository<ScriptingNotebook, ScriptingNotebookProps> {
    findByTeamAndNotebookId(teamId: string, notebookId: string): Promise<ScriptingNotebook | null>;
    findByTeamAndTrajectory(teamId: string, trajectoryId: string): Promise<ScriptingNotebook | null>;
    findAllByTeam(teamId: string, options: PaginationOptions, trajectoryId?: string): Promise<PaginatedResult<ScriptingNotebook>>;
    removeTrajectory(trajectoryId: string): Promise<void>;
};
