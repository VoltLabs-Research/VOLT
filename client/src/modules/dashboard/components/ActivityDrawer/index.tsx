import { ToggleButton, ToggleButtonGroup } from '@heroui/react';
import { Modal } from '@/shared/ui/modal/Modal';
import useDailyActivityData from '@/modules/daily-activity/hooks/use-daily-activity-data';
import ActivityTimelinePanel, { ActivityTimelineSkeleton } from '@/modules/dashboard/components/ActivityDrawer/ActivityTimelinePanel';
import InAppActivityPanel from '@/modules/dashboard/components/ActivityDrawer/InAppActivityPanel';
import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';
import { useSelectedTeam } from '@/modules/team/hooks/team/use-selected-team';
import { DASHBOARD_DRAWER_IDS } from '@/modules/dashboard/store/use-jobs-drawer-store';
import { useState } from 'react';
import type { Key, ReactNode } from 'react';
import type { Team } from '@volt/contracts/modules/team/domain';

const PERMISSION_LABELS: Record<string, string> = {
    'trajectory:read': 'View trajectories',
    'analysis:read': 'View analyses',
    'daily-activity:read': 'View team activity',
    'team-member:read': 'View team members',
    'team:read': 'View team',
    'team-role:read': 'View roles',
    'team-secret-key:read': 'View secret keys'
};

const toPermissionLabels = (keys: string[]): string[] => {
    return keys.map((key) => PERMISSION_LABELS[key] ?? key);
};

const getTeamOwnerContactHint = (team: Team | null | undefined): string | undefined => {
    const owner = team?.owner;
    if (!owner) {
        return undefined;
    }

    const fullName = `${owner.firstName ?? ''} ${owner.lastName ?? ''}`.trim();

    return `${fullName || owner.fullName?.trim() || owner.email} (team owner)`;
};

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

    const loadingState: ReactNode = isInAppTab
        ? <div className='flex items-center justify-center min-h-0 flex-1 overflow-hidden rounded-xl border border-border' />
        : <ActivityTimelineSkeleton />;

    const accessDeniedState: ReactNode = (
        <RecoveryState
            title='Access denied'
            description={accessDeniedMessage ?? 'You do not have permission to view activity.'}
            tone={RecoveryStateTone.AccessDenied}
            requiredPermissions={toPermissionLabels(['daily-activity:read'])}
            contactHint={getTeamOwnerContactHint(selectedTeam)}
            className='min-h-full'
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
            className='min-h-full'
        />
    );

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
        >
            <div className='flex h-full min-h-0 flex-col p-6 max-[768px]:p-4'>
                <div className='flex items-center justify-between gap-4 mb-3 max-[768px]:flex-col max-[768px]:items-start'>
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
