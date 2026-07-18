import { autoloadModules } from '@shared/infrastructure/bootstrap/autoload';

let dependenciesRegistered = false;

export const registerAllDependencies = async (): Promise<void> => {
    if (dependenciesRegistered) {
        return;
    }

    await autoloadModules();

    dependenciesRegistered = true;
};
