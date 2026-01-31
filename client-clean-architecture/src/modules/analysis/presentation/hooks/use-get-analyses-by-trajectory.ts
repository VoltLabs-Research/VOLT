import { useCallback } from 'react';
import useAnalysisUseCases from './use-analysis-use-cases';
import type { GetAnalysesByTrajectoryInputDTO, GetAnalysesByTrajectoryOutputDTO } from '../../application/dtos';

const useGetAnalysesByTrajectory = () => {
    const { getAnalysesByTrajectoryUseCase } = useAnalysisUseCases();

    const getAnalysesByTrajectory = useCallback(async (params: GetAnalysesByTrajectoryInputDTO): Promise<GetAnalysesByTrajectoryOutputDTO> => {
        return await getAnalysesByTrajectoryUseCase.execute(params);
    }, [getAnalysesByTrajectoryUseCase]);

    return getAnalysesByTrajectory;
};

export default useGetAnalysesByTrajectory;
