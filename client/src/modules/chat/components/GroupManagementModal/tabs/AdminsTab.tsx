import type { ReactNode } from 'react';
import { MemberListItem } from '../../MemberListItem';
import { Button, Tag } from '@voltstack/bravais';
import type { Chat } from '@volt/contracts/modules/chat/domain';

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
        <div className='flex flex-col gap-4'>
            <p className='text-base font-semibold'>
                Administrators
            </p>
            <div className='flex flex-col gap-1'>
                {chat.participants.map(renderMember)}
            </div>
        </div>
    );
};

export default AdminsTab;
