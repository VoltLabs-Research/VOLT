import './UserBadge.css';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import { CheckCircle2 } from 'lucide-react';

interface UserBadgeProps{
    label: string;
    email: string;
    onChangeClick: () => void;
};

const UserBadge = ({ label, email, onChangeClick }: UserBadgeProps) => (
    <Container className='user-badge radius-md p-1 d-flex content-between items-center gap-1'>
        <Container className='d-flex items-center gap-075 user-badge-info'>
            <CheckCircle2 size={18} className='f-shrink-0 user-badge-status-icon' />
            <Container className='d-flex column'>
                <span className='font-size-1 user-badge-label'>{label}</span>
                <span className='font-size-2 font-weight-5 user-badge-email text-truncate'>{email}</span>
            </Container>
        </Container>
        
        <Button
            variant='ghost'
            intent='neutral'
            onClick={onChangeClick}>
            Change
        </Button>
    </Container>
);

export default UserBadge;
