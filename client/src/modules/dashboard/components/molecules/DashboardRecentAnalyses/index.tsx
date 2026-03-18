import './DashboardRecentAnalyses.css';
import DashboardCard from '@/modules/dashboard/components/atoms/DashboardCard';
import useDashboardRecentAnalyses from '@/modules/dashboard/hooks/use-dashboard-recent-analyses';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import EmptyState from '@/shared/presentation/components/EmptyState';
import RecoveryState, { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
import StatusBadge from '@/shared/presentation/components/StatusBadge';
import Title from '@/shared/presentation/components/Title';
import { Skeleton } from '@mui/material';
import { FlaskConical } from 'lucide-react';
import { GoArrowRight } from 'react-icons/go';

const DashboardRecentAnalyses = () => {
    const { accessDenied, accessDeniedMessage, error, isLoading, items, openAll, openAnalysis, refresh } = useDashboardRecentAnalyses();
    let content = items.map((item) => (
        <Button
            key={item.id}
            variant='ghost'
            intent='neutral'
            className='dashboard-recent-analyses-item list-item-hoverable d-flex items-center content-between gap-075'
            onClick={() => openAnalysis(item.trajectoryId, item.id)}
        >
            <Container className='dashboard-recent-analyses-item-info d-flex column flex-1'>
                <span className='font-size-2 color-primary font-weight-5 text-truncate'>
                    {item.title}
                </span>
                <span className='font-size-1 color-muted text-truncate'>
                    {item.subtitle}
                </span>
            </Container>

            <Container className='dashboard-recent-analyses-item-meta'>
                <StatusBadge status={item.status} size='compact' />
                <span className='font-size-1 color-muted'>
                    {item.createdAtLabel}
                </span>
            </Container>
        </Button>
    ));

    if (accessDenied) {
        content = [
            <RecoveryState
                key='denied'
                title='Access denied'
                description={accessDeniedMessage ?? 'You do not have permission to view recent analyses.'}
                tone={RecoveryStateTone.AccessDenied}
                className='dashboard-recent-analyses-empty flex-1'
            />
        ];
    } else if (error) {
        content = [
            <RecoveryState
                key='error'
                title='Unable to load recent analyses'
                description={error}
                tone={RecoveryStateTone.Error}
                onRetry={() => {
                    refresh().catch(() => undefined);
                }}
                className='dashboard-recent-analyses-empty flex-1'
            />
        ];
    } else if (isLoading) {
        content = Array.from({ length: 3 }).map((_, i) => (
            <Container key={i} className='dashboard-recent-analyses-item list-item-hoverable d-flex items-center content-between gap-075'>
                <Skeleton variant='rounded' width='100%' height={40} sx={{ borderRadius: 'var(--radius-md)' }} />
            </Container>
        ));
    } else if (items.length === 0) {
        content = [
            <EmptyState
                key='empty'
                icon={<FlaskConical size={20} strokeWidth={1.5} />}
                title='No analyses yet'
                description='Completed or in-progress analysis runs will appear here once your team starts processing trajectories.'
                className='dashboard-recent-analyses-empty flex-1'
            />
        ];
    }

    return (
        <DashboardCard className='dashboard-recent-analyses d-flex column flex-1 min-h-0' overflowHidden={true}>
            <Container className='dashboard-recent-analyses-header d-flex items-center content-between w-max'>
                <Title className='font-size-2 color-primary font-weight-6'>
                    Recent Analyses
                </Title>
                <Button
                    variant='ghost'
                    intent='neutral'
                    size='sm'
                    className='dashboard-recent-analyses-view-all'
                    onClick={openAll}
                    rightIcon={<GoArrowRight size={12} />}
                >
                    View all
                </Button>
            </Container>

            <Container className='dashboard-recent-analyses-list d-flex column flex-1 y-auto gap-1 min-h-0'>
                {content}
            </Container>
        </DashboardCard>
    );
};

export default DashboardRecentAnalyses;
