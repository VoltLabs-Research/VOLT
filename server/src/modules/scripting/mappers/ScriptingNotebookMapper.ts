import { createScriptingNotebook } from '@modules/scripting/entities/ScriptingNotebook';
import { createMongoMapperFromFactory } from '@shared/infrastructure/persistence/mongo/createMongoMapper';
import type ScriptingNotebook from '@modules/scripting/entities/ScriptingNotebook';
import type { ScriptingNotebookProps } from '@modules/scripting/entities/ScriptingNotebook';
import type { ScriptingNotebookDocument } from '@modules/scripting/models/ScriptingNotebookModel';

export default createMongoMapperFromFactory<ScriptingNotebook, ScriptingNotebookProps, ScriptingNotebookDocument>(
    createScriptingNotebook,
    ['team', 'teamCluster', 'runtimeNotebookId', 'trajectory', 'createdBy']
);
