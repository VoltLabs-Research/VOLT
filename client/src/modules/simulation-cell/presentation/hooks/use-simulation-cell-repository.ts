import useResolve from '@/shared/presentation/hooks/use-resolve';
import { SIMULATION_CELL_TOKENS } from '../../infrastructure/di/tokens';
import type ISimulationCellRepository from '../../domain/port/ISimulationCellRepository';

const useSimulationCellUseCases = () => {
    return {
        simulationCellRepository: useResolve<ISimulationCellRepository>(SIMULATION_CELL_TOKENS.SimulationCellRepository)
    };
};

export default useSimulationCellUseCases;
