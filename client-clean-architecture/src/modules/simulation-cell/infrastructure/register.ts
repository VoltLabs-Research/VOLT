import { registerSimulationCellDependencies } from '../application/registry';
import { simulationCellRepository } from './repositories/SimulationCellRepository';

export const registerSimulationCellInfrastructure = (): void => {
    registerSimulationCellDependencies({
        simulationCellRepository
    });
};
