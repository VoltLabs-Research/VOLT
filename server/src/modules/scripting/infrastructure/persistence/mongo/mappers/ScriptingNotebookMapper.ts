import ScriptingNotebook from '@modules/scripting/domain/entities/ScriptingNotebook';
import { BaseMapper } from '@shared/infrastructure/persistence/mongo/MongoBaseMapper';
import type { ScriptingNotebookProps } from '@modules/scripting/domain/entities/ScriptingNotebook';
import type { ScriptingNotebookDocument } from '@modules/scripting/infrastructure/persistence/mongo/models/ScriptingNotebookModel';

class ScriptingNotebookMapper extends BaseMapper<ScriptingNotebook, ScriptingNotebookProps, ScriptingNotebookDocument> {
    constructor() {
        super(ScriptingNotebook, ['team', 'teamCluster', 'runtimeNotebookId', 'trajectories', 'createdBy']);
    }
};

export default new ScriptingNotebookMapper();
