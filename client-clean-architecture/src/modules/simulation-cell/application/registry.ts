import type { ISimulationCellRepository } from '../domain/repositories/ISimulationCellRepository';

export interface SimulationCellDependencies {
    simulationCellRepository: ISimulationCellRepository;
}

export interface SimulationCellUseCases {}

let dependencies: SimulationCellDependencies | null = null;
let useCases: SimulationCellUseCases | null = null;

const buildUseCases = (deps: SimulationCellDependencies): SimulationCellUseCases => ({});

export const registerSimulationCellDependencies = (deps: SimulationCellDependencies): void => {
    dependencies = deps;
    useCases = null;
};

export const getSimulationCellUseCases = (): SimulationCellUseCases => {
    if (!dependencies) {
        throw new Error('Simulation cell dependencies not registered');
    }

    if (!useCases) {
        useCases = buildUseCases(dependencies);
    }

    return useCases;
};
