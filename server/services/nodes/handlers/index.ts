import nodeRegistry from '@/services/nodes/node-registry';

import modifierHandler from './modifier-handler';
import argumentsHandler from './arguments-handler';
import contextHandler from './context-handler';
import foreachHandler from './foreach-handler';
import entrypointHandler from './entrypoint-handler';
import exposureHandler from './exposure-handler';
import schemaHandler from './schema-handler';
import visualizersHandler from './visualizers-handler';
import exportHandler from './export-handler';
import ifStatementHandler from './if-statement-handler';

// TODO: I think this is too verbose; perhaps we can read
// the directory directly and take what's exported by default to load it.
export const registerAllHandlers = (): void => {
    nodeRegistry.register(modifierHandler);
    nodeRegistry.register(argumentsHandler);
    nodeRegistry.register(contextHandler);
    nodeRegistry.register(foreachHandler);
    nodeRegistry.register(entrypointHandler);
    nodeRegistry.register(exposureHandler);
    nodeRegistry.register(schemaHandler);
    nodeRegistry.register(visualizersHandler);
    nodeRegistry.register(exportHandler);
    nodeRegistry.register(ifStatementHandler);
};

registerAllHandlers();

export {
    modifierHandler,
    argumentsHandler,
    contextHandler,
    foreachHandler,
    entrypointHandler,
    exposureHandler,
    schemaHandler,
    visualizersHandler,
    exportHandler,
    ifStatementHandler
};
