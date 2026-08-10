import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { useSelectedTeam } from '@/modules/team/hooks/team/use-selected-team';
import { useTeamPresenceStore } from '@/modules/team/store/team/use-team-presence-store';
import ActivityHeatmap from '@/modules/daily-activity/components/ActivityHeatmap';
import useDailyActivityData from '@/modules/daily-activity/hooks/use-daily-activity-data';
import { teamMembersResource } from '@/modules/team/hooks/member/queries';
import useTeamMemberListingActions from '@/modules/team/hooks/member/use-team-member-listing-actions';
import type { GetTeamMembersParams } from '@/modules/team/api/services/member-service';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import useTeamRoleData from '@/modules/team/hooks/role/use-team-role-data';
import DocumentListing from '@/shared/ui/components/DocumentListing';
import EditableTag from '@/shared/ui/components/EditableTag';
import { createTeamMemberColumns } from './member-columns';
import { useMemo } from 'react';
import type { DailyActivity } from '@volt/contracts/modules/daily-activity/domain';
import type { TeamMemberStats } from '@volt/contracts/modules/team/domain';
import type { SocketInvalidationConfig } from '@/shared/ui/components/DocumentListing';
import { SOCKET_TEAM_MEMBER_EVENTS } from '@/modules/socket/events/team';
import './MyTeam.css';

const TEAM_MEMBERS_QUERY_KEY = ['team-members'] as const;

const SOCKET_INVALIDATION: SocketInvalidationConfig[] = [
    {
        event: SOCKET_TEAM_MEMBER_EVENTS.CREATED,
        queryKeys: [TEAM_MEMBERS_QUERY_KEY]
    },
    {
        event: SOCKET_TEAM_MEMBER_EVENTS.DELETED,
        queryKeys: [TEAM_MEMBERS_QUERY_KEY]
    },
    {
        event: SOCKET_TEAM_MEMBER_EVENTS.LEFT,
        queryKeys: [TEAM_MEMBERS_QUERY_KEY]
    }
];

const TEAM_ACTIVITY_LOOKBACK_DAYS = 7;
const TEAM_ACTIVITY_REFRESH_INTERVAL_MS = 10_000;

const buildTimeSpentByUser = (activityData: DailyActivity[]): Map<string, number> => {
    const totalsByUser = new Map<string, number>();

    for (const entry of activityData) {
        // `DailyActivity.user` is a populate-or-id union in the contract.
        const userId = typeof entry.user === 'string'
            ? entry.user
            : entry.user._id;
        const current = totalsByUser.get(userId) ?? 0;
        totalsByUser.set(userId, current + (entry.minutesOnline || 0));
    }

    return totalsByUser;
};

export default function MyTeamTemplate() {
    const currentUser = useCurrentUser();
    const selectedTeam = useSelectedTeam()!;
    const { canAccess } = useTeamPermissions();
    const canInvite = canAccess(['team-invitation:create']);

    const { roles } = useTeamRoleData({ teamId: selectedTeam._id });
    const { queryKey, fetchData } = useMemo(
        () => teamMembersResource.createListingAccessors<GetTeamMembersParams>(selectedTeam._id),
        [selectedTeam._id]
    );
    const onlineUserIds = useTeamPresenceStore((state) => state.onlineUserIds);
    const hasPresenceSnapshot = useTeamPresenceStore((state) => state.hasPresenceSnapshot);

    const { activityData } = useDailyActivityData({ scope: 'team' });
    const { activityData: recentActivityData } = useDailyActivityData({
        range: TEAM_ACTIVITY_LOOKBACK_DAYS,
        scope: 'team',
        refetchIntervalMs: TEAM_ACTIVITY_REFRESH_INTERVAL_MS
    });
    const timeSpentByUser = useMemo(() => buildTimeSpentByUser(recentActivityData), [recentActivityData]);

    const {
        handleSaveTeamName,
        handleRoleChange,
        getTeamMemberMenuOptions
    } = useTeamMemberListingActions({
        selectedTeam,
        currentUserId: currentUser?._id,
        canInvite
    });

    const roleOptions = useMemo(() => {
        return roles.map((role) => ({
            value: role._id,
            title: role.name,
            description: role.isSystem ? 'System role' : `${role.permissions.length} permissions`
        }));
    }, [roles]);

    const columns = useMemo(() => createTeamMemberColumns({
        selectedTeam,
        currentUserId: currentUser?._id,
        canInvite,
        roleOptions,
        onRoleChange: handleRoleChange,
        onlineUserIds,
        hasPresenceSnapshot,
        timeSpentByUser
    }), [canInvite, currentUser?._id, selectedTeam, roleOptions, handleRoleChange, onlineUserIds, hasPresenceSnapshot, timeSpentByUser]);

    return (
        <div className='h-full my-team-page'>
            <DocumentListing<TeamMemberStats>
                title={(
                    <div className='flex flex-row items-center gap-4'>
                        {canInvite ? (
                            <EditableTag
                                as='h1'
                                className='text-3xl font-medium sm:font-size-4 text-foreground'
                                onSave={handleSaveTeamName}
                            >
                                {selectedTeam.name}
                            </EditableTag>
                        ) : (
                            <h1 className='text-base font-medium text-foreground text-3xl sm:font-size-4'>{selectedTeam.name}</h1>
                        )}
                    </div>
                )}
                queryKey={queryKey}
                columns={columns}
                fetchData={fetchData}
                getMenuOptions={getTeamMemberMenuOptions}
                emptyMessage='No members found in this team.'
                headerActions={<ActivityHeatmap data={activityData} />}
                socketInvalidation={SOCKET_INVALIDATION}
            />
        </div>
    );
};
