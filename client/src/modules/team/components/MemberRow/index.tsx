import type { TeamMember } from '@/modules/team/api/entities/member/team-member';
import Avatar from '@/shared/presentation/components/Avatar';
import Popover from '@/shared/presentation/components/Popover';
import PopoverMenu from '@/shared/presentation/components/PopoverMenu';
import PopoverMenuItem from '@/shared/presentation/components/PopoverMenuItem';
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
                <button
                    type='button'
                    className='member-row radius-sm d-flex items-center content-between gap-1 p-1 w-max'
                    aria-haspopup='menu'
                    aria-label={`Open actions for ${member.user.firstName} ${member.user.lastName}`}
                >
                    <div className='volt-container d-flex items-center gap-1'>
                        <Avatar
                            src={member.user.avatar}
                            alt={`${member.user.firstName} ${member.user.lastName}`}
                            size='md'
                        />
                        <div className='volt-container d-flex column'>
                            <p className='volt-text font-weight-5 color-primary d-flex items-center gap-025'>
                                {member.user.firstName} {member.user.lastName}
                                {isCurrentUser && (
                                    <span className='color-secondary font-weight-4'>(You)</span>
                                )}
                            </p>
                            <p className='volt-text font-size-2 color-secondary'>
                                {member.user.email}
                            </p>
                        </div>
                    </div>

                    <div className='volt-container d-flex items-center gap-1'>
                        <div className='volt-container member-role-badge radius-sm'>
                            {isOwner ? 'Owner' : member.role.name}
                        </div>

                            {member.joinedAt && (
                                <p className='volt-text font-size-1 color-tertiary'>
                                    Joined {formatDistanceToNow(new Date(member.joinedAt), { addSuffix: true })}
                                </p>
                            )}
                    </div>
                </button>
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
