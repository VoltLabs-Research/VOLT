import { createScriptingNotebook } from '@modules/scripting/domain/entities/ScriptingNotebook';
import { createMongoMapperFromFactory } from '@shared/infrastructure/persistence/mongo/createMongoMapper';
import type ScriptingNotebook from '@modules/scripting/domain/entities/ScriptingNotebook';
import type { ScriptingNotebookProps } from '@modules/scripting/domain/entities/ScriptingNotebook';
import type { ScriptingNotebookDocument } from '@modules/scripting/infrastructure/persistence/mongo/models/ScriptingNotebookModel';

export default createMongoMapperFromFactory<ScriptingNotebook, ScriptingNotebookProps, ScriptingNotebookDocument>(
    createScriptingNotebook,
    ['team', 'teamCluster', 'runtimeNotebookId', 'trajectory', 'createdBy']
);
