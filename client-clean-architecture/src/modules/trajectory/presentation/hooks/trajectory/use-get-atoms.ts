import { useCallback } from 'react';
import useTrajectoryUseCases from './use-trajectory-use-cases';
import type { GetAtomsInputDTO, GetAtomsOutputDTO } from '@/modules/trajectory/application/dtos/trajectory/GetAtomsDTO';

const useGetAtoms = () => {
    const { getAtomsUseCase } = useTrajectoryUseCases();

    const getAtoms = useCallback(async (params: GetAtomsInputDTO): Promise<GetAtomsOutputDTO> => {
        return await getAtomsUseCase.execute(params);
    }, [getAtomsUseCase]);

    return getAtoms;
};

export default useGetAtoms;
