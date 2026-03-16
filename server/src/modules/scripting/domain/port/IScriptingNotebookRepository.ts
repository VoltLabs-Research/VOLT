import type {
    IBaseRepository
} from '@shared/domain/port/IBaseRepository';
import type { ScriptingNotebookProps } from '@modules/scripting/domain/entities/ScriptingNotebook';
import type ScriptingNotebook from '@modules/scripting/domain/entities/ScriptingNotebook';

export interface IScriptingNotebookRepository extends IBaseRepository<ScriptingNotebook, ScriptingNotebookProps> {
    findByTeamAndNotebookId(teamId: string, notebookId: string): Promise<ScriptingNotebook | null>;
    findAllWithTrajectory(trajectoryId: string): Promise<ScriptingNotebook[]>;
    removeTrajectory(trajectoryId: string): Promise<void>;
};
