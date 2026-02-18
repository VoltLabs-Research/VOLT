import { CheckCircle2 } from 'lucide-react';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';

interface UserBadgeProps{
    label: string;
    email: string;
    onChangeClick: () => void;
};

const UserBadge = ({ label, email, onChangeClick }: UserBadgeProps) => (
    <Container className='sign-in-user-badge radius-sm p-1 d-flex content-between items-center'>
        <Container className='d-flex items-center gap-075 sign-in-user-badge-info'>
            <CheckCircle2 size={18} color='#22c55e' className='f-shrink-0' />
            <Container className='d-flex column'>
                <span className='font-size-1 color-muted'>{label}</span>
                <span className='font-size-2 font-weight-5 sign-in-user-badge-email text-truncate'>{email}</span>
            </Container>
        </Container>
        
        <Button 
            variant='ghost' 
            intent='white' 
            size='sm' 
            onClick={onChangeClick}>
            Change
        </Button>
    </Container>
);

export default UserBadge;
