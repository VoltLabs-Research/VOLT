import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { RiRefreshLine } from 'react-icons/ri';
import useAnalysisUseCases from '../../../hooks/use-analysis-use-cases';
import useDeleteAnalysis from '../../../hooks/use-delete-analysis';
import useRetryFailedFrames from '../../../hooks/use-retry-failed-frames';
import useListingActions from '@/shared/presentation/hooks/use-listing-actions';
import DocumentListing, { type ColumnConfig, createListSyncConfig } from '@/shared/presentation/components/DocumentListing';
import type { PaginationParams } from '@/shared/presentation/hooks/use-pagination-params';
import type { Analysis } from '@/modules/analysis/domain/entities';
import { dateColumn } from '@/shared/presentation/utils/column-presets';

const LIST_SYNC = createListSyncConfig('analysis');

const COLUMNS: ColumnConfig[] = [
    {
        key: 'trajectory.name',
        title: 'Trajectory',
        sortable: true,
        render: (_, row) => (row as Analysis).trajectory.name,
        skeleton: { variant: 'text', width: 140 }
    },
    {
        key: 'plugin',
        title: 'Plugin',
        sortable: true,
        render: (value) => String(value),
        skeleton: { variant: 'text', width: 110 }
    },
    {
        key: 'totalFrames',
        title: 'Total Frames',
        sortable: true,
        render: (value) => (value as number).toLocaleString(),
        skeleton: { variant: 'text', width: 90 }
    },
    dateColumn('startedAt', 'Started At'),
    dateColumn('finishedAt', 'Finished At'),
    dateColumn('createdAt', 'Created')
];

const AnalysesListing = () => {
    const navigate = useNavigate();

    const { getAnalysesUseCase } = useAnalysisUseCases();
    const deleteAnalysis = useDeleteAnalysis();
    const retryFailedFrames = useRetryFailedFrames();

    const fetchAnalyses = useCallback((params: PaginationParams) => {
        return getAnalysesUseCase.execute(params);
    }, [getAnalysesUseCase]);

    const { getMenuOptions } = useListingActions<Analysis>({
        actions: {
            view: {
                label: 'View Scene',
                handler: ({ item: analysis }) => {
                    navigate(`/canvas/${analysis.trajectory._id}`);
                }
            },
            retry: {
                label: 'Retry Failed Frames',
                icon: RiRefreshLine,
                handler: async ({ item: analysis }) => {
                    await retryFailedFrames(analysis._id);
                }
            },
            delete: {
                handler: async ({ item: analysis }) => {
                    await deleteAnalysis(analysis._id);
                },
                confirm: ({ selectedItems }) => (
                    selectedItems.length === 1
                        ? 'Delete this analysis? This cannot be undone.'
                        : `Delete ${selectedItems.length} analyses? This cannot be undone.`
                )
            }
        }
    });

    const columns: ColumnConfig[] = COLUMNS;

    return (
        <DocumentListing<Analysis>
            title='Analyses'
            columns={columns}
            fetchData={fetchAnalyses}
            defaultLimit={20}
            getMenuOptions={getMenuOptions}
            emptyMessage='No analyses found'
            listSyncConfig={LIST_SYNC}
        />
    );
};

export default AnalysesListing;
