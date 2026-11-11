import { Chip, ListBox, Select } from '@heroui/react';
import ListingUserCell from '@/shared/ui/components/ListingUserCell';
import OptionListBoxItem from '@/shared/ui/components/OptionListBoxItem';
import StatusPill from '@/shared/ui/components/StatusPill';
import { resolveTeamUserOnline } from '@/modules/team/utils/member/presence';
import { dateColumn } from '@/shared/ui/utils/column-presets';
import { formatDuration } from '@/shared/utils/format';
import { formatDistanceToNow } from 'date-fns';
import type { Key } from '@heroui/react';
import type { TeamMemberStats } from '@volt/contracts/modules/team/domain';
import { hasTeamRole, teamRoleLabel, type TeamRole } from '@volt/contracts/modules/team/access';
import type { TeamRoleOption } from '@/modules/team/utils/team/role-options';
import type { ColumnConfig } from '@/shared/ui/components/DocumentListingTable';

interface TeamMemberColumnsConfig {
    currentUserId?: string;
    actorRole: TeamRole | null;
    canManageMembers: boolean;
    roleOptions: TeamRoleOption[];
    onRoleChange: (memberId: string, role: TeamRole) => void;
    onlineUserIds: Set<string>;
    hasPresenceSnapshot: boolean;
    timeSpentByUser: Map<string, number>;
}

export const createTeamMemberColumns = ({
    currentUserId,
    actorRole,
    canManageMembers,
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
            // Nobody changes their own role or the role of someone who ranks above them.
            const canChangeRole = canManageMembers
                && currentUserId !== member.user._id
                && hasTeamRole(actorRole, member.role);

            if (canChangeRole) {
                const handleSelectionChange = (key: Key | null) => {
                    const next = roleOptions.find((option) => option.value === key);
                    if (!next || next.value === member.role) return;

                    onRoleChange(member._id, next.value);
                };

                return (
                    <Select
                        className='min-w-[120px]'
                        selectedKey={member.role}
                        onSelectionChange={handleSelectionChange}
                        placeholder='Select role...'
                        aria-label={`Role for ${member.user.email}`}
                    >
                        <Select.Trigger>
                            <Select.Value>
                                {({ isPlaceholder, selectedText, defaultChildren }) => (
                                    isPlaceholder ? defaultChildren : selectedText
                                )}
                            </Select.Value>
                            <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                            <ListBox>
                                {roleOptions.map((option) => (
                                    <OptionListBoxItem key={option.value} option={option} />
                                ))}
                            </ListBox>
                        </Select.Popover>
                    </Select>
                );
            }

            return (
                <Chip color='default' variant='soft' size='sm'>
                    <Chip.Label>{teamRoleLabel(member.role)}</Chip.Label>
                </Chip>
            );
        }
    },
    {
        key: 'status',
        title: 'Status',
        render: (_value, member) => {
            const lastSeenAt = member.user.lastSeenAt ? new Date(member.user.lastSeenAt) : null;

            if (resolveTeamUserOnline(member.user, onlineUserIds, hasPresenceSnapshot)) {
                return <StatusPill status='online' />;
            }

            return (
                <div className='flex flex-col items-start gap-1'>
                    <StatusPill status='offline' />
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
