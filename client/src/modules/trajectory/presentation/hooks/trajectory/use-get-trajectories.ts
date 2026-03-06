import { useCallback } from 'react';
import useTrajectoryUseCases from './use-trajectory-services';
import type { GetTrajectoriesInputDTO, GetTrajectoriesOutputDTO } from '@/modules/trajectory/application/dtos/trajectory/GetTrajectoriesDTO';

const useGetTrajectories = () => {
    const { trajectoryRepository } = useTrajectoryUseCases();

    const getTrajectories = useCallback(async (params: GetTrajectoriesInputDTO): Promise<GetTrajectoriesOutputDTO> => {
        return await trajectoryRepository.getAll(params);
    }, [trajectoryRepository]);

    return getTrajectories;
};

export default useGetTrajectories;
