import './UserBadge.css';
import { Button } from '@voltstack/bravais';
import { CheckCircle2 } from 'lucide-react';

interface UserBadgeProps{
    label: string;
    email: string;
    onChangeClick: () => void;
}

const UserBadge = ({ label, email, onChangeClick }: UserBadgeProps) => (
    <div className='flex flex-row items-center justify-between gap-4 p-4 rounded-xl user-badge'>
        <div className='flex flex-row items-center gap-3 flex-1 min-w-0'>
            <CheckCircle2 size={18} className='shrink-0 user-badge-status-icon' />
            <div className='flex flex-col'>
                <span className='text-xs user-badge-label'>{label}</span>
                <span className='text-sm font-medium truncate user-badge-email'>{email}</span>
            </div>
        </div>

        <Button
            variant='ghost'
            intent='neutral'
            onClick={onChangeClick}>
            Change
        </Button>
    </div>
);

export default UserBadge;
