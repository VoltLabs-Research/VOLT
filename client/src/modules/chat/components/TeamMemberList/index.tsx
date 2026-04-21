import { cn } from '@/shared/utils';
import { IoCheckmark } from 'react-icons/io5';
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
            <button
                type='button'
                key={member._id}
                className={cn('d-flex items-center gap-075 list-item-hoverable team-member-item', isSelected && 'selected')}
                role='checkbox'
                aria-checked={isSelected}
                onClick={() => onToggle(member._id)}
            >
                <div className='volt-container d-flex flex-center team-member-item-checkbox transition-normal f-shrink-0'>
                    {isSelected && <IoCheckmark size={14} className='color-white' />}
                </div>

                <Avatar user={member} size='sm' />

                <div className='volt-container d-flex column flex-1 team-member-item-info'>
                    <p className='volt-text font-size-3 font-weight-5 color-primary team-member-item-name text-truncate'>
                        {member.firstName} {member.lastName}
                    </p>
                    <p className='volt-text font-size-2 color-muted team-member-item-email text-truncate'>
                        {member.email}
                    </p>
                </div>
            </button>
        );
    };

    if (filteredMembers.length === 0) {
        return (
            <div className='volt-container d-flex flex-center p-2 text-center'>
                <p className='volt-text font-size-2 color-muted'>No team members available</p>
            </div>
        );
    }

    return (
        <div className='volt-container d-flex column gap-025 y-auto team-member-list'>
            {filteredMembers.map(renderMember)}
        </div>
    );
};

export default TeamMemberList;
