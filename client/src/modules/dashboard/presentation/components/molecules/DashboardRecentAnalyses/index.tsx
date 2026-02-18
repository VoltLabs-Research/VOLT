import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoArrowRight } from 'react-icons/go';
import { FlaskConical } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import useAnalysisUseCases from '@/modules/analysis/presentation/hooks/use-analysis-use-cases';
import StatusBadge from '@/shared/presentation/components/StatusBadge';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import type { Analysis } from '@/modules/analysis/domain/entities';
import './DashboardRecentAnalyses.css';

const DashboardRecentAnalyses: React.FC = () => {
    const navigate = useNavigate();
    const { getAnalysesUseCase } = useAnalysisUseCases();
    const [analyses, setAnalyses] = useState<Analysis[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchRecent = useCallback(async () => {
        setIsLoading(true);
        try {
            const result = await getAnalysesUseCase.execute({ page: 1, limit: 5 });
            setAnalyses(result.data);
        } catch {
            setAnalyses([]);
        } finally {
            setIsLoading(false);
        }
    }, [getAnalysesUseCase]);

    useEffect(() => {
        fetchRecent();
    }, [fetchRecent]);

    const handleViewAll = () => {
        navigate('/dashboard/analysis-configs/list');
    };

    const handleClickAnalysis = (analysis: Analysis) => {
        navigate(`/canvas/${analysis.trajectory._id}`);
    };

    return (
        <Container className='dashboard-recent-analyses'>
            <Container className='dashboard-recent-analyses-header'>
                <Title className='font-size-2 color-primary font-weight-6'>
                    Recent Analyses
                </Title>
                <button
                    className='dashboard-recent-analyses-view-all'
                    onClick={handleViewAll}
                >
                    View all <GoArrowRight size={12} />
                </button>
            </Container>

            <Container className='dashboard-recent-analyses-list d-flex column flex-1 y-auto min-h-0'>
                {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <Container key={i} className='dashboard-recent-analyses-item list-item-hoverable d-flex items-center content-between gap-075'>
                            <Container className='dashboard-skeleton-pulse' style={{ width: '100%', height: 40, borderRadius: 'var(--radius-md)' }} />
                        </Container>
                    ))
                ) : analyses.length === 0 ? (
                    <Container className='dashboard-recent-analyses-empty d-flex column items-center content-center flex-1'>
                        <FlaskConical size={20} strokeWidth={1.5} />
                        <span className='font-size-1 color-muted'>No analyses yet</span>
                    </Container>
                ) : (
                    analyses.map((analysis) => (
                        <button
                            key={analysis._id}
                            className='dashboard-recent-analyses-item list-item-hoverable d-flex items-center content-between gap-075'
                            onClick={() => handleClickAnalysis(analysis)}
                        >
                            <Container className='dashboard-recent-analyses-item-info d-flex column flex-1'>
                                <span className='font-size-2 color-primary font-weight-5 text-ellipsis'>
                                    {analysis.pluginDisplayName || analysis.plugin}
                                </span>
                                <span className='font-size-1 color-muted text-ellipsis'>
                                    {analysis.trajectory.name} &middot; {analysis.totalFrames.toLocaleString()} frames
                                </span>
                            </Container>

                            <Container className='dashboard-recent-analyses-item-meta'>
                                <StatusBadge status={analysis.status} size='compact' />
                                <span className='font-size-1 color-muted'>
                                    {formatDistanceToNow(new Date(analysis.createdAt), { addSuffix: true })}
                                </span>
                            </Container>
                        </button>
                    ))
                )}
            </Container>
        </Container>
    );
};

export default DashboardRecentAnalyses;
