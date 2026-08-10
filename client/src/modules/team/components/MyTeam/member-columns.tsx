import { Chip, Description, Label, ListBox, Select } from '@heroui/react';
import ListingUserCell from '@/shared/ui/components/ListingUserCell';
import { resolveTeamUserOnline } from '@/modules/team/utils/member/presence';
import { dateColumn } from '@/shared/ui/utils/column-presets';
import { formatDuration } from '@/shared/utils/format';
import { formatDistanceToNow } from 'date-fns';
import type { Key } from 'react-aria-components';
import type { Team, TeamMemberStats } from '@volt/contracts/modules/team/domain';
import type { ColumnConfig } from '@/shared/ui/components/DocumentListingTable';

/**
 * bravais's `SelectOption`, kept locally now that the design system is gone. The
 * shape is unchanged, so `MyTeam`'s `roleOptions` still builds the same objects.
 */
export interface TeamRoleSelectOption {
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

/**
 * `MyTeam.css`'s `.my-team-page .role-select-compact { min-width: 120px }`, which
 * bravais applied to the Select's trigger. HeroUI's Select root is the flex item, so
 * the clamp belongs on the root — the same move `FormFieldRHF`'s `SELECT_ROOT_CLASS`
 * makes, for the same reason.
 */
const ROLE_SELECT_CLASS = 'min-w-[120px]';

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
                /*
                 * bravais's `onChange` only ever fired with a value; React Aria types
                 * `onSelectionChange` as `Key | null` because a clearable select can
                 * deselect. This one cannot, so `null` is ignored rather than sent on as
                 * an empty role id.
                 */
                const handleSelectionChange = (key: Key | null) => {
                    if (key === null) return;

                    onRoleChange(member._id, String(key));
                };

                return (
                    <Select
                        className={ROLE_SELECT_CLASS}
                        selectedKey={member.role._id}
                        onSelectionChange={handleSelectionChange}
                        placeholder='Select role...'
                        aria-label={`Role for ${member.user.email}`}
                    >
                        <Select.Trigger>
                            {/*
                              * bravais's trigger showed the selected option's `title`
                              * only; RAC's default children render the whole item, so a
                              * `description` would leak into the trigger.
                              */}
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
