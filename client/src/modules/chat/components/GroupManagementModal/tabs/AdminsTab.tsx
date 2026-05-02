import type { ReactNode } from 'react';
import { MemberListItem } from '../../MemberListItem';
import Button from '@/shared/presentation/primitives/Button';
import Stack from '@/shared/presentation/primitives/Stack';
import Tag from '@/shared/presentation/primitives/Tag';
import Text from '@/shared/presentation/primitives/Text';
import type { Chat } from '@/modules/chat/api/entities/chat';

interface AdminsTabProps {
    chat: Chat;
    isOwner: boolean;
    isLoading: boolean;
    onToggleAdmin: (userId: string) => void;
}

const AdminsTab = ({ chat, isOwner, isLoading, onToggleAdmin }: AdminsTabProps) => {
    const renderMember = (member: Chat['participants'][number]) => {
        const isMemberOwner = chat.createdBy?._id === member._id;
        const isMemberAdmin = chat.admins?.some((admin) => admin._id === member._id);
        let action: ReactNode = null;

        if (isMemberOwner) {
            action = <Tag tone='info' variant='solid' size='xs'>Owner</Tag>;
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
            action = <Tag tone='brand' variant='solid' size='xs'>Admin</Tag>;
        }

        return <MemberListItem key={member._id} user={member} action={action} />;
    };

    return (
        <Stack gap='1'>
            <Text as='p' size='lg' weight='bold'>
                Administrators
            </Text>
            <Stack gap='025'>
                {chat.participants.map(renderMember)}
            </Stack>
        </Stack>
    );
};

export default AdminsTab;
