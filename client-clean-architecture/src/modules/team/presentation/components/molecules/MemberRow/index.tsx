import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { MessageCircle, UserMinus } from 'lucide-react';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Popover from '@/shared/presentation/components/Popover';
import PopoverMenu from '@/shared/presentation/components/PopoverMenu';
import PopoverMenuItem from '@/shared/presentation/components/PopoverMenuItem';
import MemberAvatar from '../MemberAvatar';
import type { TeamMember } from '@/modules/team/domain/entities/TeamMember';
import './MemberRow.css';

interface MemberRowProps {
    member: TeamMember;
    isCurrentUser: boolean;
    isOwner: boolean;
    canRemove: boolean;
    onRemove: (member: TeamMember) => void;
    onMessage?: () => void;
};

const MemberRow: React.FC<MemberRowProps> = ({
    member,
    isCurrentUser,
    isOwner,
    canRemove,
    onRemove,
    onMessage
}) => {
    return (
        <Popover
            id={`member-menu-${member._id}`}
            triggerAction='contextmenu'
            trigger={
                <Container className='member-row d-flex items-center content-between gap-1 p-1'>
                    <Container className='d-flex items-center gap-1'>
                        <MemberAvatar
                            src={member.user.avatar}
                            alt={`${member.user.firstName} ${member.user.lastName}`}
                            showStatus={false}
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
                        <Container className='member-role-badge'>
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
                                onRemove(member);
                                close();
                            }}
                        />
                    )}
                </PopoverMenu>
            )}
        </Popover>
    );
};

export default MemberRow;
