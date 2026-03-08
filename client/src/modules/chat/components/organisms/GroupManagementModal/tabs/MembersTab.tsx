import type { Chat } from '@/modules/chat/api/entities/chat';
import type { User } from '@/modules/auth/api/entities/user';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Button from '@/shared/presentation/components/Button';
import { MemberListItem } from '@/modules/team/components/molecules';
import { TeamMemberList } from '../../../molecules';
import { getMemberRole } from '@/modules/chat/utilities';

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
    <Container className='d-flex column gap-1'>
        <Paragraph className='font-size-3 font-weight-6 color-primary'>
            Current Members ({chat.participants.length})
        </Paragraph>
        <Container className='d-flex column gap-025'>
            {chat.participants.map((member) => (
                <MemberListItem
                    key={member._id}
                    user={member}
                    role={getMemberRole(chat, member._id)}
                />
            ))}
        </Container>

        {canEdit && availableMembers.length > 0 && (
            <>
                <Paragraph className='font-size-3 font-weight-6 color-primary mt-1'>
                    Add Members
                </Paragraph>
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
    </Container>
);

export default MembersTab;
