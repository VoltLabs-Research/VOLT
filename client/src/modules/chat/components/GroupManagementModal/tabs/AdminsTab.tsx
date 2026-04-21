import type { ReactNode } from 'react';
import { MemberListItem } from '../../MemberListItem';
import Button from '@/shared/presentation/components/Button';
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
            action = <p className='volt-text member-list-item-role owner'>Owner</p>;
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
            action = <p className='volt-text member-list-item-role admin'>Admin</p>;
        }

        return <MemberListItem key={member._id} user={member} action={action} />;
    };

    return (
        <div className='volt-container d-flex column gap-1'>
            <p className='volt-text font-size-3 font-weight-6 color-primary'>
                Administrators
            </p>
            <div className='volt-container d-flex column gap-025'>
                {chat.participants.map(renderMember)}
            </div>
        </div>
    );
};

export default AdminsTab;
