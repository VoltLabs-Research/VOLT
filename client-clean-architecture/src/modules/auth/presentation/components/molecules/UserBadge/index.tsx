import { CheckCircle2 } from 'lucide-react';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';

interface UserBadgeProps{
    label: string;
    email: string;
    onChangeClick: () => void;
};

const UserBadge = ({ label, email, onChangeClick }: UserBadgeProps) => (
    <Container className='p-1 d-flex content-between items-center b-soft b-radius-08 glass-bg'>
        <Container className='d-flex items-center gap-075 flex-1' style={{ minWidth: 0 }}>
            <CheckCircle2 size={18} color='#22c55e' className='f-shrink-0' />
            <Container className='d-flex column'>
                <span className='font-size-1 color-muted'>{label}</span>
                <span className='font-size-2 font-weight-5 text-truncate'>{email}</span>
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
