import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoArrowRight } from 'react-icons/go';
import { FlaskConical } from 'lucide-react';
import { Skeleton } from '@mui/material';
import { formatDistanceToNow } from 'date-fns';
import useAnalysisUseCases from '@/modules/analysis/presentation/hooks/use-analysis-use-cases';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import StatusBadge from '@/shared/presentation/components/StatusBadge';
import Container from '@/shared/presentation/components/Container';
import EmptyState from '@/shared/presentation/components/EmptyState';
import AccessDenied from '@/shared/presentation/components/AccessDenied';
import Title from '@/shared/presentation/components/Title';
import Button from '@/shared/presentation/components/Button';
import type { Analysis } from '@/modules/analysis/domain/entities';
import './DashboardRecentAnalyses.css';

const DashboardRecentAnalyses: React.FC = () => {
    const navigate = useNavigate();
    const { getAnalysesUseCase } = useAnalysisUseCases();
    const [analyses, setAnalyses] = useState<Analysis[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { accessDenied, accessDeniedMessage, checkRBACError } = useAccessDenied();

    const fetchRecent = useCallback(async () => {
        setIsLoading(true);
        try {
            const result = await getAnalysesUseCase.execute({ page: 1, limit: 5 });
            setAnalyses(result.data);
        } catch(error) {
            if(checkRBACError(error)) return;
            setAnalyses([]);
        } finally {
            setIsLoading(false);
        }
    }, [getAnalysesUseCase, checkRBACError]);

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
            <Container className='dashboard-recent-analyses-header d-flex items-center content-between w-max'>
                <Title className='font-size-2 color-primary font-weight-6'>
                    Recent Analyses
                </Title>
                <Button
                    variant='ghost'
                    intent='neutral'
                    size='sm'
                    className='dashboard-recent-analyses-view-all'
                    onClick={handleViewAll}
                    rightIcon={<GoArrowRight size={12} />}
                >
                    View all
                </Button>
            </Container>

            <Container className='dashboard-recent-analyses-list d-flex column flex-1 y-auto gap-1 min-h-0'>
                {accessDenied ? (
                    <AccessDenied description={accessDeniedMessage} showBack={false} />
                ) : isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <Container key={i} className='dashboard-recent-analyses-item list-item-hoverable d-flex items-center content-between gap-075'>
                            <Skeleton variant='rounded' width='100%' height={40} sx={{ borderRadius: 'var(--radius-md)' }} />
                        </Container>
                    ))
                ) : analyses.length === 0 ? (
                    <EmptyState
                        icon={<FlaskConical size={20} strokeWidth={1.5} />}
                        title='No analyses yet'
                        description=''
                        className='dashboard-recent-analyses-empty flex-1'
                    />
                ) : (
                    analyses.map((analysis) => (
                        <Button
                            key={analysis._id}
                            variant='ghost'
                            intent='neutral'
                            className='dashboard-recent-analyses-item list-item-hoverable d-flex items-center content-between gap-075'
                            onClick={() => handleClickAnalysis(analysis)}
                        >
                            <Container className='dashboard-recent-analyses-item-info d-flex column flex-1'>
                                <span className='font-size-2 color-primary font-weight-5 text-truncate'>
                                    {analysis.pluginDisplayName || analysis.plugin}
                                </span>
                                <span className='font-size-1 color-muted text-truncate'>
                                    {analysis.trajectory.name} &middot; {analysis.totalFrames.toLocaleString()} frames
                                </span>
                            </Container>

                            <Container className='dashboard-recent-analyses-item-meta'>
                                <StatusBadge status={analysis.status} size='compact' />
                                <span className='font-size-1 color-muted'>
                                    {formatDistanceToNow(new Date(analysis.createdAt), { addSuffix: true })}
                                </span>
                            </Container>
                        </Button>
                    ))
                )}
            </Container>
        </Container>
    );
};

export default DashboardRecentAnalyses;
