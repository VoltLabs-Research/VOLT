import { Select, StatusBadge } from '@voltstack/bravais';
import type { SelectOption } from '@voltstack/bravais';
import ListingUserCell from '@/shared/ui/components/ListingUserCell';
import { resolveTeamUserOnline } from '@/modules/team/utils/member/presence';
import { dateColumn } from '@/shared/ui/utils/column-presets';
import { formatDuration } from '@/shared/utils/format';
import { formatDistanceToNow } from 'date-fns';
import type { Team, TeamMemberStats } from '@volt/contracts/modules/team/domain';
import type { ColumnConfig } from '@/shared/ui/components/DocumentListingTable';

interface TeamMemberColumnsConfig {
    selectedTeam: Team;
    currentUserId?: string;
    canInvite: boolean;
    roleOptions: SelectOption[];
    onRoleChange: (memberId: string, roleId: string) => void;
    onlineUserIds: Set<string>;
    hasPresenceSnapshot: boolean;
    timeSpentByUser: Map<string, number>;
}

export const createTeamMemberColumns = ({
    selectedTeam,
    currentUserId,
    canInvite,
    roleOptions,
    onRoleChange,
    onlineUserIds,
    hasPresenceSnapshot,
    timeSpentByUser
}: TeamMemberColumnsConfig): ColumnConfig<TeamMemberStats>[] => [
    {
        key: 'user',
        title: 'User',
        render: (_value, member) => (
            <ListingUserCell
                user={member.user}
                showStatus
                showCurrentUserSuffix
            />
        )
    },
    {
        key: 'role',
        title: 'Role',
        render: (_value, member) => {
            if (selectedTeam.owner._id === member.user._id) {
                return <StatusBadge variant='primary'>Owner</StatusBadge>;
            }

            if (canInvite && currentUserId !== member.user._id && roleOptions.length > 0) {
                return (
                    <Select
                        options={roleOptions}
                        value={member.role._id}
                        onChange={(roleId) => onRoleChange(member._id, roleId)}
                        placeholder='Select role...'
                        className='role-select-compact'
                    />
                );
            }

            return <StatusBadge variant='neutral'>{member.role.name}</StatusBadge>;
        }
    },
    {
        key: 'status',
        title: 'Status',
        render: (_value, member) => {
            const lastSeenAt = member.user.lastSeenAt ? new Date(member.user.lastSeenAt) : null;

            if (resolveTeamUserOnline(member.user, onlineUserIds, hasPresenceSnapshot)) {
                return <StatusBadge status='online' size='compact'>Online</StatusBadge>;
            }

            return (
                <div className='flex flex-col'>
                    <StatusBadge status='offline' size='compact'>Offline</StatusBadge>
                    <span className='text-sm text-muted'>
                        {lastSeenAt
                            ? `Seen ${formatDistanceToNow(lastSeenAt)} ago`
                            : 'Last seen unavailable'}
                    </span>
                </div>
            );
        }
    },
    {
        key: 'timeSpentLast7Days',
        title: 'Time (7d)',
        render: (_value, member) => (
            <span className='text-sm text-muted'>
                {formatDuration(timeSpentByUser.get(member.user._id) ?? 0)}
            </span>
        )
    },
    dateColumn<TeamMemberStats>('joinedAt', 'Joined At', {
        sortable: false,
        withTitle: true
    })
];
