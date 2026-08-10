import { ToggleButton, ToggleButtonGroup } from '@heroui/react';
import { Modal } from '@/shared/ui/modal';
import useDailyActivityData from '@/modules/daily-activity/hooks/use-daily-activity-data';
import ActivityTimelinePanel, { ActivityTimelineSkeleton } from '@/modules/dashboard/components/ActivityDrawer/ActivityTimelinePanel';
import InAppActivityPanel from '@/modules/dashboard/components/ActivityDrawer/InAppActivityPanel';
import { CARD_STATE, CHART_SURFACE } from '@/modules/dashboard/components/ActivityDrawer/activity-chrome';
import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';
import { getTeamOwnerContactHint, toPermissionLabels } from '@/modules/dashboard/utils/access-denied-hints';
import { useSelectedTeam } from '@/modules/team/hooks/team/use-selected-team';
import { DASHBOARD_DRAWER_IDS } from '@/modules/dashboard/store/use-jobs-drawer-store';
import { useState } from 'react';
import type { Key, ReactNode } from 'react';

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

const DASHBOARD_ACTIVITY_TAB_IDS: ReadonlySet<string> = new Set(DASHBOARD_ACTIVITY_TABS.map((tab) => tab.id));

const isDashboardActivityTabId = (value: string): value is DashboardActivityTabId => DASHBOARD_ACTIVITY_TAB_IDS.has(value);

/** `.dashboard-activity-drawer`. */
const DRAWER = 'flex h-full min-h-0 flex-col p-6 max-[768px]:p-4';

/** `.dashboard-tabbed-card-header`. */
const HEADER = 'flex items-center justify-between gap-4 mb-3 max-[768px]:flex-col max-[768px]:items-start';

const ActivityDrawer = () => {
    const [activeTab, setActiveTab] = useState<DashboardActivityTabId>('in-app-activity');
    const selectedTeam = useSelectedTeam();
    const { activityData, isLoading, error, accessDenied, accessDeniedMessage, fetchActivity } = useDailyActivityData({
        range: ACTIVITY_LOOKBACK_DAYS,
        scope: 'self',
        refetchIntervalMs: ACTIVITY_REFRESH_INTERVAL_MS
    });

    const isInAppTab = activeTab === 'in-app-activity';

    const handleTabChange = (keys: Set<Key>) => {
        for (const key of keys) {
            if (typeof key === 'string' && isDashboardActivityTabId(key)) {
                setActiveTab(key);
                return;
            }
        }
    };

    /*
     * An empty bordered box, not a spinner: it reserves the chart's own footprint so
     * the panel does not resize when the data lands.
     */
    const loadingState: ReactNode = isInAppTab
        ? <div className={`flex items-center justify-center ${CHART_SURFACE}`} />
        : <ActivityTimelineSkeleton />;

    const accessDeniedState: ReactNode = (
        <RecoveryState
            title='Access denied'
            description={accessDeniedMessage ?? 'You do not have permission to view activity.'}
            tone={RecoveryStateTone.AccessDenied}
            requiredPermissions={toPermissionLabels(['daily-activity:read'])}
            contactHint={getTeamOwnerContactHint(selectedTeam)}
            className={CARD_STATE}
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
            className={CARD_STATE}
        />
    );

    /*
     * bravais's `AsyncBoundary`, inlined at its exact precedence — accessDenied →
     * error → loading → children. This boundary declared no `empty` slot, so an empty
     * data set falls through to the panels, which each render their own empty state.
     */
    let activityContent: ReactNode = isInAppTab
        ? <InAppActivityPanel activityData={activityData} />
        : <ActivityTimelinePanel activityData={activityData} lookbackDays={ACTIVITY_LOOKBACK_DAYS} />;

    if (accessDenied) {
        activityContent = accessDeniedState;
    } else if (error) {
        activityContent = renderError(error);
    } else if (isLoading) {
        activityContent = loadingState;
    }

    return (
        <Modal
            id={DASHBOARD_DRAWER_IDS.activity}
            placement='right'
            title='Your activity'
            description={isInAppTab ? 'Avg / day of week' : 'Last 7 days'}
            lazyMount
        >
            <div className={DRAWER}>
                <div className={HEADER}>
                    <ToggleButtonGroup
                        selectionMode='single'
                        disallowEmptySelection
                        selectedKeys={[activeTab]}
                        onSelectionChange={handleTabChange}
                        aria-label='Dashboard activity views'
                    >
                        {DASHBOARD_ACTIVITY_TABS.map((tab) => (
                            <ToggleButton key={tab.id} id={tab.id}>
                                {tab.label}
                            </ToggleButton>
                        ))}
                    </ToggleButtonGroup>
                </div>

                {activityContent}
            </div>
        </Modal>
    );
};

export default ActivityDrawer;
