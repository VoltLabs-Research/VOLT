import { analysisQuery } from '@/modules/analysis/hooks/queries';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import { formatDistanceToNow } from 'date-fns';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

export interface DashboardRecentAnalysisItem {
    id: string;
    title: string;
    subtitle: string;
    status: string;
    createdAtLabel: string;
    trajectoryId: string;
};

export const useDashboardRecentAnalyses = () => {
    const navigate = useNavigate();
    const { accessDenied, accessDeniedMessage, checkAccessDeniedError } = useAccessDenied();

    const recentAnalysesQuery = analysisQuery.useListQuery(
        { page: 1, limit: 5 },
        {
            retry: (failureCount, error) => {
                if (checkAccessDeniedError(error)) {
                    return false;
                }

                return failureCount < 3;
            }
        }
    );

    const items = useMemo((): DashboardRecentAnalysisItem[] => {
        return (recentAnalysesQuery.data?.data ?? []).map((analysis) => ({
            id: analysis._id,
            title: analysis.pluginDisplayName || analysis.plugin,
            subtitle: `${analysis.trajectory.name} · ${analysis.totalFrames.toLocaleString()} frames`,
            status: analysis.status,
            createdAtLabel: formatDistanceToNow(new Date(analysis.createdAt), { addSuffix: true }),
            trajectoryId: analysis.trajectory._id
        }));
    }, [recentAnalysesQuery.data]);

    const openAll = () => {
        navigate('/dashboard/analysis-configs/list');
    };

    const openAnalysis = (trajectoryId: string) => {
        navigate(`/canvas/${trajectoryId}`);
    };

    return {
        accessDenied,
        accessDeniedMessage,
        isLoading: recentAnalysesQuery.isLoading,
        items,
        openAll,
        openAnalysis
    };
};

export default useDashboardRecentAnalyses;
