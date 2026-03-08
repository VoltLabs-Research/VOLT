import { useCallback } from 'react';
import { fetchTrajectoryAtoms } from './trajectory/queries';
import type { GetAtomsInputDTO, GetAtomsOutputDTO } from '../api/dtos/get-atoms';

const useGetAtoms = () => {
    const getAtoms = useCallback(async (params: GetAtomsInputDTO): Promise<GetAtomsOutputDTO> => {
        return await fetchTrajectoryAtoms(params);
    }, []);

    return getAtoms;
};

export default useGetAtoms;
