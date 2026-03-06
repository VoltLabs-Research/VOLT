import { injectable } from 'tsyringe';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import ScriptingNotebook, { ScriptingNotebookProps } from '@modules/scripting/domain/entities/ScriptingNotebook';
import { IScriptingNotebookRepository } from '@modules/scripting/domain/port/IScriptingNotebookRepository';
import ScriptingNotebookModel, { ScriptingNotebookDocument } from '@modules/scripting/infrastructure/persistence/mongo/models/ScriptingNotebookModel';
import scriptingNotebookMapper from '@modules/scripting/infrastructure/persistence/mongo/mappers/ScriptingNotebookMapper';

@injectable()
export default class ScriptingNotebookRepository
    extends MongooseBaseRepository<ScriptingNotebook, ScriptingNotebookProps, ScriptingNotebookDocument>
    implements IScriptingNotebookRepository {

    constructor() {
        super(ScriptingNotebookModel, scriptingNotebookMapper);
    }

    async removeTrajectory(trajectoryId: string): Promise<void> {
        await this.model.updateMany({
            trajectories: trajectoryId
        }, {
            $pull: {
                trajectories: trajectoryId
            }
        });

        await this.model.deleteMany({
            trajectories: {
                $size: 0
            }
        });
    }
}
