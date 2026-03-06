import { useMemo } from 'react';
import { container } from 'tsyringe';
import { SIMULATION_CELL_TOKENS } from '../../infrastructure/di/tokens';
import type ISimulationCellRepository from '../../domain/port/ISimulationCellRepository';

const useSimulationCellUseCases = () => {
    return useMemo(() => ({
        simulationCellRepository: container.resolve<ISimulationCellRepository>(SIMULATION_CELL_TOKENS.SimulationCellRepository)
    }), []);
};

export default useSimulationCellUseCases;
