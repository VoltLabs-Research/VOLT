import type AIToolController from '@shared/ai/AIToolController';

type AIToolControllerConstructor = new () => AIToolController;

const providers = new Set<AIToolControllerConstructor>();

let instances: AIToolController[] | null = null;

/**
 * Registers a module's AI tool surface.
 *
 * `autoloadModules()` already imports every file of every *enabled* module at
 * boot, so decorating the class is all that is needed for its tools to be
 * exposed. This replaces a central list that had to name all 19 controllers:
 * that list made `ai` import from 16 other modules, closed an import cycle back
 * through `AiService`, and — because it imported controllers unconditionally —
 * kept exposing the tools of modules that `VOLT_MODULES` had disabled.
 */
export const AIToolProvider = (): ClassDecorator =>
    ((target: AIToolControllerConstructor): void => {
        providers.add(target);
        instances = null;
    }) as ClassDecorator;

/** Controller instances, built once and reused across requests. */
export const getRegisteredAIToolProviders = (): readonly AIToolController[] => {
    instances ??= Array.from(providers, (Provider) => new Provider());
    return instances;
};
