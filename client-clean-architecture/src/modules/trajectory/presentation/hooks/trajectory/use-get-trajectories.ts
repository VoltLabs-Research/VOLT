import { useCallback } from 'react';
import useTrajectoryUseCases from './use-trajectory-use-cases';
import type { GetTrajectoriesInputDTO, GetTrajectoriesOutputDTO } from '@/modules/trajectory/application/dtos/trajectory/GetTrajectoriesDTO';

const useGetTrajectories = () => {
    const { getTrajectoriesUseCase } = useTrajectoryUseCases();

    const getTrajectories = useCallback(async (params: GetTrajectoriesInputDTO): Promise<GetTrajectoriesOutputDTO> => {
        return await getTrajectoriesUseCase.execute(params);
    }, [getTrajectoriesUseCase]);

    return getTrajectories;
};

export default useGetTrajectories;

