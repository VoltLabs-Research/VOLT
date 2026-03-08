import React from 'react';
import { GoArrowRight } from 'react-icons/go';
import { FlaskConical } from 'lucide-react';
import { Skeleton } from '@mui/material';
import useDashboardRecentAnalyses from '@/modules/dashboard/hooks/use-dashboard-recent-analyses';
import StatusBadge from '@/shared/presentation/components/StatusBadge';
import Container from '@/shared/presentation/components/Container';
import EmptyState from '@/shared/presentation/components/EmptyState';
import AccessDenied from '@/shared/presentation/components/AccessDenied';
import Title from '@/shared/presentation/components/Title';
import Button from '@/shared/presentation/components/Button';
import './DashboardRecentAnalyses.css';

const DashboardRecentAnalyses: React.FC = () => {
    const { accessDenied, accessDeniedMessage, isLoading, items, openAll, openAnalysis } = useDashboardRecentAnalyses();

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
                    onClick={openAll}
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
                ) : items.length === 0 ? (
                    <EmptyState
                        icon={<FlaskConical size={20} strokeWidth={1.5} />}
                        title='No analyses yet'
                        description=''
                        className='dashboard-recent-analyses-empty flex-1'
                    />
                ) : (
                    items.map((item) => (
                        <Button
                            key={item.id}
                            variant='ghost'
                            intent='neutral'
                            className='dashboard-recent-analyses-item list-item-hoverable d-flex items-center content-between gap-075'
                            onClick={() => openAnalysis(item.trajectoryId)}
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
                    ))
                )}
            </Container>
        </Container>
    );
};

export default DashboardRecentAnalyses;
