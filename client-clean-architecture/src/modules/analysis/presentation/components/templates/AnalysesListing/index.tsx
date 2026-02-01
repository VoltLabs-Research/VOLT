import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { RiRefreshLine } from 'react-icons/ri';
import useAnalysisStore from '../../../stores/use-analysis-store';
import useAnalysisUseCases from '../../../hooks/use-analysis-use-cases';
import useDeleteAnalysis from '../../../hooks/use-delete-analysis';
import useRetryFailedFrames from '../../../hooks/use-retry-failed-frames';
import useListingActions from '@/shared/presentation/hooks/use-listing-actions';
import DocumentListing, { type ColumnConfig } from '@/shared/presentation/components/DocumentListing';
import { formatRelativeDate } from '@/shared/utils/format';
import type { Analysis } from '@/modules/analysis/domain/entities';
import type { PaginatedResponse } from '@/shared/domain/pagination';

const AnalysesListing = () => {
    const navigate = useNavigate();

    const analyses = useAnalysisStore((state) => state.analyses);
    const setAnalyses = useAnalysisStore((state) => state.setAnalyses);
    const appendAnalyses = useAnalysisStore((state) => state.appendAnalyses);

    const { getAnalysesUseCase } = useAnalysisUseCases();
    const deleteAnalysis = useDeleteAnalysis();
    const retryFailedFrames = useRetryFailedFrames();

    const handleDataFetched = useCallback((result: PaginatedResponse<Analysis>, isFirstPage: boolean) => {
        if(isFirstPage) {
            setAnalyses(result.data);
        } else {
            appendAnalyses(result.data);
        }
    }, [setAnalyses, appendAnalyses]);

    const { getMenuOptions } = useListingActions<Analysis>({
        actions: {
            view: {
                label: 'View Scene',
                handler: (analysis) => {
                    if(analysis.trajectory?._id) {
                        navigate(`/canvas/${analysis.trajectory._id}`);
                    }
                }
            },
            retry: {
                label: 'Retry Failed Frames',
                icon: RiRefreshLine,
                handler: async (analysis) => {
                    await retryFailedFrames(analysis._id);
                }
            },
            delete: {
                handler: async (analysis) => {
                    await deleteAnalysis(analysis._id);
                },
                confirm: 'Delete this analysis? This cannot be undone.'
            }
        }
    });

    const columns: ColumnConfig[] = useMemo(() => [
        {
            key: 'trajectory.name',
            title: 'Trajectory',
            sortable: true,
            render: (_, row) => (row as Analysis).trajectory?.name ?? '-',
            skeleton: { variant: 'text', width: 140 }
        },
        {
            key: 'plugin',
            title: 'Plugin',
            sortable: true,
            render: (value) => value ? String(value) : '-',
            skeleton: { variant: 'text', width: 110 }
        },
        {
            key: 'totalFrames',
            title: 'Total Frames',
            sortable: true,
            render: (value) => typeof value === 'number' ? value.toLocaleString() : '-',
            skeleton: { variant: 'text', width: 90 }
        },
        {
            key: 'startedAt',
            title: 'Started At',
            sortable: true,
            render: (value) => formatRelativeDate(value),
            skeleton: { variant: 'text', width: 100 }
        },
        {
            key: 'finishedAt',
            title: 'Finished At',
            sortable: true,
            render: (value) => formatRelativeDate(value),
            skeleton: { variant: 'text', width: 100 }
        },
        {
            key: 'createdAt',
            title: 'Created',
            sortable: true,
            render: (value) => formatRelativeDate(value),
            skeleton: { variant: 'text', width: 100 }
        }
    ], []);

    return (
        <DocumentListing<Analysis>
            title='Analyses'
            columns={columns}
            data={analyses}
            fetchData={getAnalysesUseCase.execute}
            onDataFetched={handleDataFetched}
            defaultLimit={20}
            getMenuOptions={getMenuOptions}
            emptyMessage='No analyses found'
        />
    );
};

export default AnalysesListing;
