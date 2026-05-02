import './UserBadge.css';
import Button from '@/shared/presentation/primitives/Button';
import Row from '@/shared/presentation/primitives/Row';
import Stack from '@/shared/presentation/primitives/Stack';
import Text from '@/shared/presentation/primitives/Text';
import { CheckCircle2 } from 'lucide-react';

interface UserBadgeProps{
    label: string;
    email: string;
    onChangeClick: () => void;
}

const UserBadge = ({ label, email, onChangeClick }: UserBadgeProps) => (
    <Row radius='md' p='1' justify='between' gap='1' className='user-badge'>
        <Row gap='075' flex='1' className='min-w-0'>
            <CheckCircle2 size={18} className='f-shrink-0 user-badge-status-icon' />
            <Stack>
                <Text size='sm' className='user-badge-label'>{label}</Text>
                <Text size='md' weight='medium' truncate className='user-badge-email'>{email}</Text>
            </Stack>
        </Row>

        <Button
            variant='ghost'
            intent='neutral'
            onClick={onChangeClick}>
            Change
        </Button>
    </Row>
);

export default UserBadge;
