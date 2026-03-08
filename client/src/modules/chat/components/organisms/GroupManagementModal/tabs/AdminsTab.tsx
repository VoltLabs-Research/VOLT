import type { Chat } from '@/modules/chat/api/entities/chat';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Button from '@/shared/presentation/components/Button';
import { MemberListItem } from '@/modules/team/components/molecules';

interface AdminsTabProps {
    chat: Chat;
    isOwner: boolean;
    isLoading: boolean;
    onToggleAdmin: (userId: string) => void;
};

const AdminsTab = ({ chat, isOwner, isLoading, onToggleAdmin }: AdminsTabProps) => (
    <Container className='d-flex column gap-1'>
        <Paragraph className='font-size-3 font-weight-6 color-primary'>
            Administrators
        </Paragraph>
        <Container className='d-flex column gap-025'>
            {chat.participants.map((member) => {
                const isMemberOwner = chat.createdBy?._id === member._id;
                const isMemberAdmin = chat.admins?.some((a) => a._id === member._id);

                const action = isMemberOwner ? (
                    <Paragraph className='member-list-item-role owner'>Owner</Paragraph>
                ) : isOwner ? (
                    <Button
                        variant={isMemberAdmin ? 'soft' : 'ghost'}
                        intent={isMemberAdmin ? 'danger' : 'brand'}
                        size='sm'
                        onClick={() => onToggleAdmin(member._id)}
                        disabled={isLoading}
                    >
                        {isMemberAdmin ? 'Remove Admin' : 'Make Admin'}
                    </Button>
                ) : isMemberAdmin ? (
                    <Paragraph className='member-list-item-role admin'>Admin</Paragraph>
                ) : null;

                return (
                    <MemberListItem
                        key={member._id}
                        user={member}
                        action={action}
                    />
                );
            })}
        </Container>
    </Container>
);

export default AdminsTab;
