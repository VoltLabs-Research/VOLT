import type { ReactNode } from 'react';
import { MemberListItem } from '../../MemberListItem';
import { Button, Chip } from '@heroui/react';
import type { Chat } from '@volt/contracts/modules/chat/domain';

interface AdminsTabProps {
    chat: Chat;
    isOwner: boolean;
    isLoading: boolean;
    onToggleAdmin: (userId: string) => void;
}

/* The same two chips MemberListItem paints for a role, here as a standalone
   badge: solid info for the owner, the accent for an admin. */
const OWNER_CHIP_CLASS_NAMES = 'bg-info text-info-foreground';

const ADMIN_CHIP_CLASS_NAMES = 'bg-accent text-accent-foreground';

const AdminsTab = ({ chat, isOwner, isLoading, onToggleAdmin }: AdminsTabProps) => {
    const renderMember = (member: Chat['participants'][number]) => {
        const isMemberOwner = chat.createdBy?._id === member._id;
        const isMemberAdmin = chat.admins?.some((admin) => admin._id === member._id);
        let action: ReactNode = null;

        if (isMemberOwner) {
            action = (
                <Chip size='sm' className={OWNER_CHIP_CLASS_NAMES}>
                    <Chip.Label>Owner</Chip.Label>
                </Chip>
            );
        } else if (isOwner) {
            action = (
                <Button
                    variant={isMemberAdmin ? 'danger-soft' : 'ghost'}
                    size='sm'
                    onPress={() => onToggleAdmin(member._id)}
                    isDisabled={isLoading}
                >
                    {isMemberAdmin ? 'Remove Admin' : 'Make Admin'}
                </Button>
            );
        } else if (isMemberAdmin) {
            action = (
                <Chip size='sm' className={ADMIN_CHIP_CLASS_NAMES}>
                    <Chip.Label>Admin</Chip.Label>
                </Chip>
            );
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
