import ScriptingNotebook from '@modules/scripting/domain/entities/ScriptingNotebook';
import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';
import type { ScriptingNotebookProps } from '@modules/scripting/domain/entities/ScriptingNotebook';
import type { ScriptingNotebookDocument } from '@modules/scripting/infrastructure/persistence/mongo/models/ScriptingNotebookModel';

export default createMongoMapper<ScriptingNotebook, ScriptingNotebookProps, ScriptingNotebookDocument>(ScriptingNotebook, ['team', 'teamCluster', 'runtimeNotebookId', 'trajectories', 'createdBy']);
