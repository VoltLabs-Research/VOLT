import type { ReactNode } from 'react';
import { MemberListItem } from '../../../molecules';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import type { Chat } from '@/modules/chat/api/entities/chat';

interface AdminsTabProps {
    chat: Chat;
    isOwner: boolean;
    isLoading: boolean;
    onToggleAdmin: (userId: string) => void;
};

const AdminsTab = ({ chat, isOwner, isLoading, onToggleAdmin }: AdminsTabProps) => {
    const renderMember = (member: Chat['participants'][number]) => {
        const isMemberOwner = chat.createdBy?._id === member._id;
        const isMemberAdmin = chat.admins?.some((admin) => admin._id === member._id);
        let action: ReactNode = null;

        if (isMemberOwner) {
            action = <Paragraph className='member-list-item-role owner'>Owner</Paragraph>;
        } else if (isOwner) {
            action = (
                <Button
                    variant={isMemberAdmin ? 'soft' : 'ghost'}
                    intent={isMemberAdmin ? 'danger' : 'brand'}
                    size='sm'
                    onClick={() => onToggleAdmin(member._id)}
                    disabled={isLoading}
                >
                    {isMemberAdmin ? 'Remove Admin' : 'Make Admin'}
                </Button>
            );
        } else if (isMemberAdmin) {
            action = <Paragraph className='member-list-item-role admin'>Admin</Paragraph>;
        }

        return <MemberListItem key={member._id} user={member} action={action} />;
    };

    return (
        <Container className='d-flex column gap-1'>
            <Paragraph className='font-size-3 font-weight-6 color-primary'>
                Administrators
            </Paragraph>
            <Container className='d-flex column gap-025'>
                {chat.participants.map(renderMember)}
            </Container>
        </Container>
    );
};

export default AdminsTab;
