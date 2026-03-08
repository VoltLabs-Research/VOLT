import type { TeamMember } from '@/modules/team/api/entities/member/team-member';
import Avatar from '@/shared/presentation/components/Avatar';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Popover from '@/shared/presentation/components/Popover';
import PopoverMenu from '@/shared/presentation/components/PopoverMenu';
import PopoverMenuItem from '@/shared/presentation/components/PopoverMenuItem';
import { confirm } from '@/shared/presentation/hooks/use-confirm';
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
    const handleRemove = () => {
        const memberName = `${member.user.firstName} ${member.user.lastName}`;
        if(!confirm(`Are you sure you want to remove ${memberName} from this team? This action cannot be undone.`)) return;
        onRemove(member);
    };

    return (
        <Popover
            id={`member-menu-${member._id}`}
            triggerAction='contextmenu'
            trigger={
                <Container className='member-row radius-sm d-flex items-center content-between gap-1 p-1'>
                    <Container className='d-flex items-center gap-1'>
                        <Avatar
                            src={member.user.avatar}
                            alt={`${member.user.firstName} ${member.user.lastName}`}
                            size='md'
                        />
                        <Container className='d-flex column'>
                            <Paragraph className='font-weight-5 color-primary d-flex items-center gap-025'>
                                {member.user.firstName} {member.user.lastName}
                                {isCurrentUser && (
                                    <span className='color-secondary font-weight-4'>(You)</span>
                                )}
                            </Paragraph>
                            <Paragraph className='font-size-2 color-secondary'>
                                {member.user.email}
                            </Paragraph>
                        </Container>
                    </Container>

                    <Container className='d-flex items-center gap-1'>
                        <Container className='member-role-badge radius-sm'>
                            {isOwner ? 'Owner' : member.role.name}
                        </Container>

                        {member.joinedAt && (
                            <Paragraph className='font-size-1 color-tertiary'>
                                Joined {formatDistanceToNow(new Date(member.joinedAt), { addSuffix: true })}
                            </Paragraph>
                        )}
                    </Container>
                </Container>
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
