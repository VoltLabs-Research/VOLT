import { autoloadModules } from '@shared/infrastructure/bootstrap/autoload';

let modulesLoaded = false;

export const loadAllModules = async (): Promise<void> => {
    if (modulesLoaded) {
        return;
    }

    await autoloadModules();

    modulesLoaded = true;
};
