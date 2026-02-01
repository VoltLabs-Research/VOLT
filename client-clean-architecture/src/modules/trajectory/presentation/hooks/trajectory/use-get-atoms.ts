import { useCallback } from 'react';
import useTrajectoryUseCases from './use-trajectory-use-cases';
import type { GetAtomsInputDTO, GetAtomsOutputDTO } from '@/modules/trajectory/application/dtos/trajectory/GetAtomsDTO';

const useGetAtoms = () => {
    const { trajectoryRepository } = useTrajectoryUseCases();

    const getAtoms = useCallback(async (params: GetAtomsInputDTO): Promise<GetAtomsOutputDTO> => {
        return await trajectoryRepository.getAtoms(params);
    }, [trajectoryRepository]);

    return getAtoms;
};

export default useGetAtoms;
