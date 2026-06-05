import type { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import type ScriptingNotebook from '@modules/scripting/domain/entities/ScriptingNotebook';
import type { ScriptingNotebookProps } from '@modules/scripting/domain/entities/ScriptingNotebook';

export interface IScriptingNotebookRepository extends IBaseRepository<ScriptingNotebook, ScriptingNotebookProps> {
    findByTeamAndNotebookId(teamId: string, notebookId: string): Promise<ScriptingNotebook | null>;
    removeTrajectory(trajectoryId: string): Promise<void>;
    findAllWithTrajectory(trajectoryId: string): Promise<ScriptingNotebook[]>;
}
