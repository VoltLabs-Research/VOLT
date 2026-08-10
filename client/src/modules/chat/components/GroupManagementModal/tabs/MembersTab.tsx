import { getMemberRole } from '@/modules/chat/utils/chat/chat-display';
import TeamMemberList from '../../TeamMemberList';
import { MemberListItem } from '../../MemberListItem';
import { Button } from '@heroui/react';
import type { User } from '@volt/contracts/modules/auth/domain';
import type { Chat } from '@volt/contracts/modules/chat/domain';

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
    <div className='flex flex-col gap-4'>
        <p className='text-base font-semibold'>
            Current Members ({chat.participants.length})
        </p>
        <div className='flex flex-col gap-1'>
            {chat.participants.map((member) => (
                <MemberListItem
                    key={member._id}
                    user={member}
                    role={getMemberRole(chat, member._id)}
                />
            ))}
        </div>

        {canEdit && availableMembers.length > 0 && (
            <>
                <p className='text-base font-semibold mt-4'>
                    Add Members
                </p>
                <TeamMemberList
                    members={availableMembers}
                    selectedIds={selectedMembers}
                    currentUserId={currentUserId}
                    onToggle={onToggleSelected}
                />
                {selectedMembers.length > 0 && (
                    <Button
                        variant='primary'
                        onPress={onAddMembers}
                        isPending={isLoading}
                    >
                        Add {selectedMembers.length} Member{selectedMembers.length > 1 ? 's' : ''}
                    </Button>
                )}
            </>
        )}
    </div>
);

export default MembersTab;
