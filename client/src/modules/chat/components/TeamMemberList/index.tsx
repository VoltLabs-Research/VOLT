import { cn } from '@/shared/utils/cn';
import { Check } from 'lucide-react';
import { Avatar, ListRow } from '@voltstack/bravais';
import type { User } from '@volt/contracts/modules/auth/domain';
import './TeamMemberList.css';

interface TeamMemberListProps {
    members: User[];
    selectedIds: string[];
    currentUserId?: string;
    onToggle: (userId: string) => void;
}

const TeamMemberList = ({ members, selectedIds, currentUserId, onToggle }: TeamMemberListProps) => {
    const filteredMembers = members.filter((m) => m._id !== currentUserId);

    const renderMember = (member: User) => {
        const isSelected = selectedIds.includes(member._id);

        const leading = (
            <div className='flex flex-row items-center gap-2'>
                <div className='flex shrink-0 transition-[all] duration-200 ease-out-fluid items-center justify-center team-member-item-checkbox'>
                    {isSelected && <Check size={14} style={{ color: 'var(--color-on-accent)' }} />}
                </div>
                <Avatar user={member} size='sm' />
            </div>
        );

        return (
            <ListRow
                key={member._id}
                leading={leading}
                title={`${member.firstName} ${member.lastName}`}
                subtitle={member.email}
                role='checkbox'
                aria-checked={isSelected}
                selected={isSelected}
                onClick={() => onToggle(member._id)}
                className={cn('team-member-item', isSelected && 'selected')}
            />
        );
    };

    if (filteredMembers.length === 0) {
        return (
            <div className='flex p-8 text-center items-center justify-center'>
                <p className='text-sm text-muted'>No team members available</p>
            </div>
        );
    }

    return (
        <div className='flex flex-col gap-1 overflow-y-auto team-member-list'>
            {filteredMembers.map(renderMember)}
        </div>
    );
};

export default TeamMemberList;
