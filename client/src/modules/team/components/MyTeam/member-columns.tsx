import { Chip, Description, Label, ListBox, Select } from '@heroui/react';
import ListingUserCell from '@/shared/ui/components/ListingUserCell';
import { resolveTeamUserOnline } from '@/modules/team/utils/member/presence';
import { dateColumn } from '@/shared/ui/utils/column-presets';
import { formatDuration } from '@/shared/utils/format';
import { formatDistanceToNow } from 'date-fns';
import type { Key } from 'react-aria-components';
import type { Team, TeamMemberStats } from '@volt/contracts/modules/team/domain';
import type { ColumnConfig } from '@/shared/ui/components/DocumentListingTable';

interface TeamRoleSelectOption {
    value: string;
    title: string;
    description?: string;
}

interface TeamMemberColumnsConfig {
    selectedTeam: Team;
    currentUserId?: string;
    canInvite: boolean;
    roleOptions: TeamRoleSelectOption[];
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
                return (
                    <Chip color='default' variant='soft' size='sm'>
                        <Chip.Label>Owner</Chip.Label>
                    </Chip>
                );
            }

            if (canInvite && currentUserId !== member.user._id && roleOptions.length > 0) {
                const handleSelectionChange = (key: Key | null) => {
                    if (key === null) return;

                    onRoleChange(member._id, String(key));
                };

                return (
                    <Select
                        className='min-w-[120px]'
                        selectedKey={member.role._id}
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
                                    <ListBox.Item key={option.value} id={option.value} textValue={option.title}>
                                        <ListBox.ItemIndicator />
                                        <Label>{option.title}</Label>
                                        {option.description && <Description>{option.description}</Description>}
                                    </ListBox.Item>
                                ))}
                            </ListBox>
                        </Select.Popover>
                    </Select>
                );
            }

            return (
                <Chip color='default' variant='soft' size='sm'>
                    <Chip.Label>{member.role.name}</Chip.Label>
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
                return (
                    <Chip color='success' variant='soft' size='sm'>
                        <Chip.Label>Online</Chip.Label>
                    </Chip>
                );
            }

            return (
                <div className='flex flex-col'>
                    <Chip color='default' variant='soft' size='sm'>
                        <Chip.Label>Offline</Chip.Label>
                    </Chip>
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
