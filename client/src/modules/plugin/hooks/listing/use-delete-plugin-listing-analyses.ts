import { useCallback } from 'react';
import { analysisQuery } from '@/modules/analysis/hooks/queries';
import { confirm } from '@/shared/presentation/hooks/use-confirm';
import { runCrudMutation } from '@/shared/presentation/hooks/toast';
import { sileo } from 'sileo';
import type { ListingRow } from '@/modules/plugin/api/entities/listing/listing-row';
import { isAccessDeniedError } from '@/shared/errors/core';

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

        const isConfirmed = await confirm(
            analysisIds.length === 1
                ? 'Delete this analysis? This cannot be undone.'
                : `Delete ${analysisIds.length} analyses? This cannot be undone.`
        );
        if (!isConfirmed) return;

        try {
            await Promise.all(analysisIds.map((analysisId) =>
                runCrudMutation(deleteAnalysisMutation.mutateAsync(analysisId), { action: 'Deleting', subject: 'Analysis' })
            ));
        } catch(error: unknown) {
            if (isAccessDeniedError(error)) return;
        }
    }, [deleteAnalysisMutation]);
};

export default useDeletePluginListingAnalyses;
