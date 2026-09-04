import { useCallback } from 'react';
import { analysisQuery } from '@/modules/analysis/hooks/queries';
import { confirm } from '@/shared/ui/hooks/use-confirm';
import { runCrudMutation } from '@/shared/ui/hooks/toast';
import { sileo } from 'sileo';
import type { ListingRow } from '@volt/contracts/modules/plugin/listing';
import { createListingDeleteConfirmation } from '@/shared/ui/utils/listing-messages';

const deleteAnalysisMessage = createListingDeleteConfirmation<ListingRow>({
    singularName: 'analysis',
    pluralName: 'analyses',
    untitledLabel: 'Untitled Analysis',
    getTitle: (row) => row.trajectoryName ?? undefined
});

const useDeletePluginListingAnalyses = () => {
    const deleteAnalysisMutation = analysisQuery.useDeleteMutation();

    return useCallback(async (rows: ListingRow[]) => {
        const analysisIds = rows
            .map((row) => row.analysisId)
            .filter((analysisId): analysisId is string => Boolean(analysisId));

        if (!analysisIds.length) {
            sileo.error({ title: 'No analysis ID found for deletion' });
            return;
        }

        const matchingRows = rows.filter((row) => analysisIds.includes(String(row.analysisId)));
        const isConfirmed = await confirm(deleteAnalysisMessage(matchingRows));
        if (!isConfirmed) return;

        await Promise.all(analysisIds.map((analysisId) =>
            runCrudMutation(deleteAnalysisMutation.mutateAsync(analysisId), {
                action: 'Deleting',
                subject: 'Analysis'
            })
        )).catch(() => undefined);
    }, [deleteAnalysisMutation]);
};

export default useDeletePluginListingAnalyses;