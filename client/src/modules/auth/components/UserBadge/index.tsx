import { Button } from '@heroui/react';
import { CheckCircle2 } from 'lucide-react';

interface UserBadgeProps{
    label: string;
    email: string;
    onChangeClick: () => void;
}

const UserBadge = ({ label, email, onChangeClick }: UserBadgeProps) => (
    <div className='flex flex-row items-center justify-between gap-4 rounded-xl border border-border/85 p-4'>
        <div className='flex min-w-0 flex-1 flex-row items-center gap-3'>
            <CheckCircle2 size={18} className='shrink-0 text-success' />
            <div className='flex flex-col'>
                <span className='text-xs text-muted'>{label}</span>
                <span className='block truncate text-sm font-medium text-foreground'>{email}</span>
            </div>
        </div>

        <Button
            variant='ghost'
            onPress={onChangeClick}>
            Change
        </Button>
    </div>
);

export default UserBadge;
