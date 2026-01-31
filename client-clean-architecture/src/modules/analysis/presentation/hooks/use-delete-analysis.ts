import { useCallback } from 'react';
import useAnalysisStore from '../stores/use-analysis-store';
import useAnalysisUseCases from './use-analysis-use-cases';

const useDeleteAnalysis = () => {
    const { deleteAnalysisUseCase } = useAnalysisUseCases();
    const analyses = useAnalysisStore((state) => state.analyses);
    const removeAnalysis = useAnalysisStore((state) => state.removeAnalysis);
    const setAnalyses = useAnalysisStore((state) => state.setAnalyses);

    const deleteAnalysis = useCallback(async (id: string) => {
        const previousAnalyses = analyses;

        // Optimistic delete
        removeAnalysis(id);

        try {
            await deleteAnalysisUseCase.execute({ id });
        } catch {
            // Rollback
            setAnalyses(previousAnalyses);
        }
    }, [deleteAnalysisUseCase, analyses, removeAnalysis, setAnalyses]);

    return deleteAnalysis;
};

export default useDeleteAnalysis;
