import { getMemberRole } from '@/modules/chat/utilities/chat/chat-display';
import TeamMemberList from '../../TeamMemberList';
import { MemberListItem } from '../../MemberListItem';
import Button from '@/shared/presentation/components/Button';
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
};

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
    <div className='volt-container d-flex column gap-1'>
        <p className='volt-text font-size-3 font-weight-6 color-primary'>
            Current Members ({chat.participants.length})
        </p>
        <div className='volt-container d-flex column gap-025'>
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
                <p className='volt-text font-size-3 font-weight-6 color-primary mt-1'>
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
    </div>
);

export default MembersTab;
