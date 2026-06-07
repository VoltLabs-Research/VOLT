import { getMemberRole } from '@/modules/chat/utilities/chat/chat-display';
import TeamMemberList from '../../TeamMemberList';
import { MemberListItem } from '../../MemberListItem';
import { Button, Stack, Text } from '@voltstack/bravais';
import type { User } from '@/modules/auth/api/entities/user';
import type { Chat } from '@/modules/chat/api/entities/chat';

interface MembersTabProps {
    chat: Chat;
    availableMembers: User[];
    selectedMembers: string[];
    currentUserId?: string;
    isLoading: boolean;
    canEdit: boolean;
    onToggleSelected: (id: string) => void;
    onAddMembers: () => void;
}

const MembersTab = ({
    chat,
    availableMembers,
    selectedMembers,
    currentUserId,
    isLoading,
    canEdit,
    onToggleSelected,
    onAddMembers
}: MembersTabProps) => (
    <Stack gap='1'>
        <Text as='p' size='lg' weight='bold'>
            Current Members ({chat.participants.length})
        </Text>
        <Stack gap='025'>
            {chat.participants.map((member) => (
                <MemberListItem
                    key={member._id}
                    user={member}
                    role={getMemberRole(chat, member._id)}
                />
            ))}
        </Stack>

        {canEdit && availableMembers.length > 0 && (
            <>
                <Text as='p' size='lg' weight='bold' className='mt-1'>
                    Add Members
                </Text>
                <TeamMemberList
                    members={availableMembers}
                    selectedIds={selectedMembers}
                    currentUserId={currentUserId}
                    onToggle={onToggleSelected}
                />
                {selectedMembers.length > 0 && (
                    <Button
                        variant='solid'
                        intent='brand'
                        onClick={onAddMembers}
                        isLoading={isLoading}
                    >
                        Add {selectedMembers.length} Member{selectedMembers.length > 1 ? 's' : ''}
                    </Button>
                )}
            </>
        )}
    </Stack>
);

export default MembersTab;
