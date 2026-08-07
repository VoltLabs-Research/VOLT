import './ActivityDrawer.css';
import { AsyncBoundary, Box, Modal, SegmentedTabs } from '@voltstack/bravais';
import useDailyActivityData from '@/modules/daily-activity/hooks/use-daily-activity-data';
import ActivityTimelinePanel, { ActivityTimelineSkeleton } from '@/modules/dashboard/components/ActivityDrawer/ActivityTimelinePanel';
import InAppActivityPanel from '@/modules/dashboard/components/ActivityDrawer/InAppActivityPanel';
import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';
import { getTeamOwnerContactHint, toPermissionLabels } from '@/modules/dashboard/utils/access-denied-hints';
import { useSelectedTeam } from '@/modules/team/hooks/team/use-selected-team';
import { DASHBOARD_DRAWER_IDS } from '@/modules/dashboard/store/use-jobs-drawer-store';
import { useState } from 'react';
import type { ReactNode } from 'react';

type DashboardActivityTabId = 'activity' | 'in-app-activity';

const ACTIVITY_LOOKBACK_DAYS = 7;
const ACTIVITY_REFRESH_INTERVAL_MS = 10_000;
const DASHBOARD_ACTIVITY_TABS: Array<{ id: DashboardActivityTabId; label: string }> = [
    {
        id: 'activity',
        label: 'Activity'
    },
    {
        id: 'in-app-activity',
        label: 'In-app Activity'
    }
];

const ActivityDrawer = () => {
    const [activeTab, setActiveTab] = useState<DashboardActivityTabId>('in-app-activity');
    const selectedTeam = useSelectedTeam();
    const { activityData, isLoading, error, accessDenied, accessDeniedMessage, fetchActivity } = useDailyActivityData({
        range: ACTIVITY_LOOKBACK_DAYS,
        scope: 'self',
        refetchIntervalMs: ACTIVITY_REFRESH_INTERVAL_MS
    });

    const isInAppTab = activeTab === 'in-app-activity';

    const loadingState: ReactNode = isInAppTab
        ? <Box display='flex' className='dashboard-activity-chart-surface items-center justify-center' />
        : <ActivityTimelineSkeleton />;

    const accessDeniedState: ReactNode = (
        <RecoveryState
            title='Access denied'
            description={accessDeniedMessage ?? 'You do not have permission to view activity.'}
            tone={RecoveryStateTone.AccessDenied}
            requiredPermissions={toPermissionLabels(['daily-activity:read'])}
            contactHint={getTeamOwnerContactHint(selectedTeam)}
            className='dashboard-card-state'
        />
    );

    const renderError = (errValue: unknown): ReactNode => (
        <RecoveryState
            title='Unable to load activity'
            description={typeof errValue === 'string' ? errValue : 'Unknown error'}
            tone={RecoveryStateTone.Error}
            onRetry={() => {
                fetchActivity().catch(() => undefined);
            }}
            className='dashboard-card-state'
        />
    );

    return (
        <Modal
            id={DASHBOARD_DRAWER_IDS.activity}
            placement='right'
            title='Your activity'
            description={isInAppTab ? 'Avg / day of week' : 'Last 7 days'}
            lazyMount
        >
            <Box className='dashboard-activity-drawer'>
                <Box className='dashboard-tabbed-card-header'>
                    <SegmentedTabs
                        tabs={DASHBOARD_ACTIVITY_TABS}
                        activeTab={activeTab}
                        onChange={setActiveTab}
                        ariaLabel='Dashboard activity views'
                    />
                </Box>

                <AsyncBoundary
                    state={{
                        loading: isLoading,
                        error: error || undefined,
                        accessDenied
                    }}
                    loading={loadingState}
                    error={renderError}
                    accessDenied={accessDeniedState}
                >
                    {isInAppTab
                        ? <InAppActivityPanel activityData={activityData} />
                        : <ActivityTimelinePanel activityData={activityData} lookbackDays={ACTIVITY_LOOKBACK_DAYS} />}
                </AsyncBoundary>
            </Box>
        </Modal>
    );
};

export default ActivityDrawer;
