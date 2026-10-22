import { Button } from '@heroui/react';

interface UserBadgeProps{
    label: string;
    email: string;
    onChangeClick: () => void;
}

const UserBadge = ({ label, email, onChangeClick }: UserBadgeProps) => (
    <div className='flex items-center gap-3 rounded-xl bg-foreground/5 py-2.5 pr-2 pl-3'>
        <div className='flex min-w-0 flex-1 flex-col'>
            <span className='text-xs text-muted'>{label}</span>
            <span className='truncate text-sm font-medium text-foreground'>{email}</span>
        </div>

        <Button
            variant='ghost'
            size='sm'
            className='text-muted hover:text-foreground'
            onPress={onChangeClick}>
            Change
        </Button>
    </div>
);

export default UserBadge;
