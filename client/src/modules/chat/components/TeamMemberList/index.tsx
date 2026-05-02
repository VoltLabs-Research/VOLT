import { cn } from '@/shared/utils';
import { IoCheckmark } from 'react-icons/io5';
import Avatar from '@/shared/presentation/primitives/Avatar';
import Box from '@/shared/presentation/primitives/Box';
import ListRow from '@/shared/presentation/primitives/ListRow';
import Row from '@/shared/presentation/primitives/Row';
import Stack from '@/shared/presentation/primitives/Stack';
import Text from '@/shared/presentation/primitives/Text';
import type { User } from '@/modules/auth/api/entities/user';
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
            <Row gap='05'>
                <Box display='flex' shrink='0' transition='normal' className='flex-center team-member-item-checkbox'>
                    {isSelected && <IoCheckmark size={14} className='color-white' />}
                </Box>
                <Avatar user={member} size='sm' />
            </Row>
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
            <Box display='flex' p='2' textAlign='center' className='flex-center'>
                <Text as='p' size='md' tone='muted'>No team members available</Text>
            </Box>
        );
    }

    return (
        <Stack gap='025' overflow='y-auto' className='team-member-list'>
            {filteredMembers.map(renderMember)}
        </Stack>
    );
};

export default TeamMemberList;
