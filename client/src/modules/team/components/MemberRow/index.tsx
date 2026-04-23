import { Avatar, ListRow, Popover, Tag } from '@/shared/presentation/primitives';
import type { TeamMember } from '@/modules/team/api/entities/member/team-member';
import { PopoverMenu } from '@/shared/presentation/primitives';
import { PopoverMenuItem } from '@/shared/presentation/primitives';
import { confirm, ConfirmActionTone } from '@/shared/presentation/hooks/use-confirm';
import { formatDistanceToNow } from 'date-fns';
import { MessageCircle, UserMinus } from 'lucide-react';
import './MemberRow.css';

interface MemberRowProps {
    member: TeamMember;
    isCurrentUser: boolean;
    isOwner: boolean;
    canRemove: boolean;
    onRemove: (member: TeamMember) => void;
    onMessage?: () => void;
};

export const MemberRow = ({
    member,
    isCurrentUser,
    isOwner,
    canRemove,
    onRemove,
    onMessage
}: MemberRowProps) => {
    const handleRemove = async () => {
        const memberName = `${member.user.firstName} ${member.user.lastName}`;
        const isConfirmed = await confirm({
            title: `Remove ${memberName} from this team?`,
            description: 'This immediately removes the member from the team and cannot be undone.',
            confirmText: 'Remove member',
            cancelText: 'Cancel',
            tone: ConfirmActionTone.Danger
        });

        if (!isConfirmed) return;
        onRemove(member);
    };

    return (
        <Popover
            id={`member-menu-${member._id}`}
            triggerAction='contextmenu'
            trigger={
                <ListRow
                    as='button'
                    className='member-row'
                    aria-haspopup='menu'
                    aria-label={`Open actions for ${member.user.firstName} ${member.user.lastName}`}
                    leading={
                        <Avatar
                            src={member.user.avatar}
                            alt={`${member.user.firstName} ${member.user.lastName}`}
                            size='md'
                        />
                    }
                    title={
                        <span className='d-flex items-center gap-025'>
                            {member.user.firstName} {member.user.lastName}
                            {isCurrentUser && (
                                <span className='color-secondary font-weight-4'>(You)</span>
                            )}
                        </span>
                    }
                    subtitle={member.user.email}
                    trailing={
                        <>
                            <Tag size='sm' className='member-role-badge'>
                                {isOwner ? 'Owner' : member.role.name}
                            </Tag>
                            {member.joinedAt && (
                                <p className='font-size-1 color-tertiary'>
                                    Joined {formatDistanceToNow(new Date(member.joinedAt), { addSuffix: true })}
                                </p>
                            )}
                        </>
                    }
                />
            }
        >
            {(close) => (
                <PopoverMenu>
                    {onMessage && (
                        <PopoverMenuItem
                            icon={<MessageCircle size={16} />}
                            label='Send Message'
                            onClick={() => {
                                onMessage();
                                close();
                            }}
                        />
                    )}
                    {canRemove && (
                        <PopoverMenuItem
                            icon={<UserMinus size={16} />}
                            label='Remove Member'
                            variant='danger'
                            onClick={() => {
                                handleRemove();
                                close();
                            }}
                        />
                    )}
                </PopoverMenu>
            )}
        </Popover>
    );
};
