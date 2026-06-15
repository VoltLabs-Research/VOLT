import type { ClientToolHandler, ClientToolModule } from './types';

/**
 * Client-tool registry. Mirrors the server's autoload-by-convention: every file
 * under `./handlers/*.ts` that default-exports a `ClientToolHandler` is picked
 * up here automatically. Adding a client tool is therefore ONE new file — no
 * edit to this registry, eliminating merge contention across parallel work.
 *
 * The handler's `name` is the key and MUST match the server tool's `name`
 * (the server advertises the schema; the client runs the effect).
 */
const handlerModules = import.meta.glob<ClientToolModule>('./handlers/*.ts', { eager: true });

const buildRegistry = (): Map<string, ClientToolHandler> => {
    const registry = new Map<string, ClientToolHandler>();

    for (const [path, module] of Object.entries(handlerModules)) {
        const handler = module.default;
        if (!handler || typeof handler.run !== 'function' || !handler.name) {
            console.warn(`[ai-tools] skipping invalid client tool module: ${path}`);
            continue;
        }

        if (registry.has(handler.name)) {
            console.warn(`[ai-tools] duplicate client tool name "${handler.name}" from ${path}; keeping the first.`);
            continue;
        }

        registry.set(handler.name, handler);
    }

    return registry;
};

const clientToolRegistry = buildRegistry();

export const getClientTool = (name: string): ClientToolHandler | undefined => {
    return clientToolRegistry.get(name);
};
