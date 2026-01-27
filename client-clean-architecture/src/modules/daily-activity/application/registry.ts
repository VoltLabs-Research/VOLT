import type { IDailyActivityRepository } from '../domain/repositories/IDailyActivityRepository';

export interface DailyActivityDependencies {
    dailyActivityRepository: IDailyActivityRepository;
}

export interface DailyActivityUseCases {}

let dependencies: DailyActivityDependencies | null = null;
let useCases: DailyActivityUseCases | null = null;

const buildUseCases = (deps: DailyActivityDependencies): DailyActivityUseCases => ({});

export const registerDailyActivityDependencies = (deps: DailyActivityDependencies): void => {
    dependencies = deps;
    useCases = null;
};

export const getDailyActivityUseCases = (): DailyActivityUseCases => {
    if (!dependencies) {
        throw new Error('Daily activity dependencies not registered');
    }

    if (!useCases) {
        useCases = buildUseCases(dependencies);
    }

    return useCases;
};
