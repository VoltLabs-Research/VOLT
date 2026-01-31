import { useCallback } from 'react';
import useAnalysisUseCases from './use-analysis-use-cases';
import type { GetAnalysesInputDTO, GetAnalysesOutputDTO } from '../../application/dtos';

const useGetAnalyses = () => {
    const { getAnalysesUseCase } = useAnalysisUseCases();

    const getAnalyses = useCallback(async (params: GetAnalysesInputDTO): Promise<GetAnalysesOutputDTO> => {
        return await getAnalysesUseCase.execute(params);
    }, [getAnalysesUseCase]);

    return getAnalyses;
};

export default useGetAnalyses;
