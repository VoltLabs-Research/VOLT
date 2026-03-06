import { useCallback } from 'react';
import useAnalysisStore from '../stores/use-analysis-store';
import useAnalysisUseCases from './use-analysis-services';

const useDeleteAnalysis = () => {
    const { deleteAnalysisUseCase } = useAnalysisUseCases();
    const analyses = useAnalysisStore((state) => state.analyses);
    const removeAnalysis = useAnalysisStore((state) => state.removeAnalysis);
    const setAnalyses = useAnalysisStore((state) => state.setAnalyses);

    return useCallback(async (id: string) => {
        const previousItems = analyses;
        removeAnalysis(id);
        try {
            await deleteAnalysisUseCase.execute({ id });
        } catch (error) {
            setAnalyses(previousItems);
            throw error;
        }
    }, [deleteAnalysisUseCase, analyses, removeAnalysis, setAnalyses]);
};

export default useDeleteAnalysis;
