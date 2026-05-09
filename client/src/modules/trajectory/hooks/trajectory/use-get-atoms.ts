import { fetchTrajectoryAtoms } from './queries';
import { useCallback } from 'react';
import type { GetAtomsInputDTO, GetAtomsOutputDTO } from '../../api/services/trajectory-service';

export default function useGetAtoms() {
    const getAtoms = useCallback(async (params: GetAtomsInputDTO): Promise<GetAtomsOutputDTO> => {
        return await fetchTrajectoryAtoms(params);
    }, []);

    return getAtoms;
}
