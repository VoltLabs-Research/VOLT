import type { ClientToolHandler, ClientToolModule } from '@/modules/ai/contracts/tools';

const handlerModules = import.meta.glob<ClientToolModule>('./handlers/*.ts', { eager: true });

const buildRegistry = (): Map<string, ClientToolHandler> => {
    const registry = new Map<string, ClientToolHandler>();

    for (const [path, module] of Object.entries(handlerModules)) {
        const handler = module.default;

        // Two handlers claiming the same tool name is the one invariant the compiler
        // cannot see: each file type-checks alone, and `name` is only compared here.
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
