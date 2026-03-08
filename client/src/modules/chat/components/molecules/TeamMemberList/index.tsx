import { cn } from '@/shared/utils';
import { IoCheckmark } from 'react-icons/io5';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Avatar from '@/shared/presentation/components/Avatar';
import type { User } from '@/modules/auth/api/entities/user';
import './TeamMemberList.css';

interface TeamMemberListProps {
    members: User[];
    selectedIds: string[];
    currentUserId?: string;
    onToggle: (userId: string) => void;
};

const TeamMemberList = ({ members, selectedIds, currentUserId, onToggle }: TeamMemberListProps) => {
    const filteredMembers = members.filter((m) => m._id !== currentUserId);

    const renderMember = (member: User) => {
        const isSelected = selectedIds.includes(member._id);

        return (
            <Container
                key={member._id}
                className={cn('d-flex items-center gap-075 list-item-hoverable team-member-item', isSelected && 'selected')}
                onClick={() => onToggle(member._id)}
            >
                <Container className='d-flex flex-center team-member-item-checkbox transition-normal f-shrink-0'>
                    {isSelected && <IoCheckmark size={14} className='color-white' />}
                </Container>

                <Avatar user={member} size='sm' />

                <Container className='d-flex column flex-1 team-member-item-info'>
                    <Paragraph className='font-size-2-5 font-weight-5 color-primary team-member-item-name text-truncate'>
                        {member.firstName} {member.lastName}
                    </Paragraph>
                    <Paragraph className='font-size-1 color-muted team-member-item-email text-truncate'>
                        {member.email}
                    </Paragraph>
                </Container>
            </Container>
        );
    };

    if (filteredMembers.length === 0) {
        return (
            <Container className='d-flex flex-center p-2 text-center'>
                <Paragraph className='font-size-2 color-muted'>No team members available</Paragraph>
            </Container>
        );
    }

    return (
        <Container className='d-flex column gap-025 y-auto team-member-list'>
            {filteredMembers.map(renderMember)}
        </Container>
    );
};

export default TeamMemberList;
