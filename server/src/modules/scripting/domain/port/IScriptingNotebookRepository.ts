import { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import ScriptingNotebook, { ScriptingNotebookProps } from '@modules/scripting/domain/entities/ScriptingNotebook';

export interface IScriptingNotebookRepository extends IBaseRepository<ScriptingNotebook, ScriptingNotebookProps> {
    removeTrajectory(trajectoryId: string): Promise<void>;
}
