import type { IAnalysisRepository } from '../domain/repositories';

export interface AnalysisDependencies {
    analysisRepository: IAnalysisRepository;
}

export interface AnalysisUseCases {}

let dependencies: AnalysisDependencies | null = null;
let useCases: AnalysisUseCases | null = null;

const buildUseCases = (deps: AnalysisDependencies): AnalysisUseCases => ({});

export const registerAnalysisDependencies = (deps: AnalysisDependencies): void => {
    dependencies = deps;
    useCases = null;
};

export const getAnalysisUseCases = (): AnalysisUseCases => {
    if (!dependencies) {
        throw new Error('Analysis dependencies not registered');
    }

    if (!useCases) {
        useCases = buildUseCases(dependencies);
    }

    return useCases;
};
