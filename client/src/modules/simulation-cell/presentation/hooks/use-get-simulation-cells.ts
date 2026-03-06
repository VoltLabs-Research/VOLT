import { useCallback } from 'react';
import useSimulationCellUseCases from './use-simulation-cell-repository';
import type { GetSimulationCellsInputDTO, GetSimulationCellsOutputDTO } from '../../application/dtos';

const useGetSimulationCells = () => {
    const { simulationCellRepository } = useSimulationCellUseCases();

    const getSimulationCells = useCallback(async (
        params: GetSimulationCellsInputDTO
    ): Promise<GetSimulationCellsOutputDTO> => {
        return await simulationCellRepository.getAll(params);
    }, [simulationCellRepository]);

    return getSimulationCells;
};

export default useGetSimulationCells;
