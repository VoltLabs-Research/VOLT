import Button from '@/shared/presentation/primitives/Button';
import Heading from '@/shared/presentation/primitives/Heading';
import Row from '@/shared/presentation/primitives/Row';
import Stack from '@/shared/presentation/primitives/Stack';
import Text from '@/shared/presentation/primitives/Text';
import './AccessDenied.css';
import { ShieldOff } from 'lucide-react';
import { useId } from 'react';
import { useNavigate } from 'react-router-dom';
interface AccessDeniedProps {
    title?: string;
    description?: string;
    showBack?: boolean;
    className?: string;
    headingLevel?: 'h1' | 'h2' | 'h3';
};

const AccessDenied = ({
    title = 'Access Denied',
    description = 'You do not have permission to perform this action. Contact your team administrator to request access.',
    showBack = true,
    className,
    headingLevel = 'h2'
}: AccessDeniedProps) => {
    const navigate = useNavigate();
    const headingId = useId();
    const level = Number(headingLevel.slice(1)) as 1 | 2 | 3;

    return (
        <Row as='section' aria-labelledby={headingId} justify='center' width='max' height='max' className={`access-denied-container ${className || ''}`}>
            <Stack align='center' gap='1-5' textAlign='center' className='access-denied-content'>
                <Row justify='center' className='access-denied-icon'>
                    <ShieldOff size={24} />
                </Row>

                <Stack gap='05' textAlign='center'>
                    <Heading level={level} id={headingId}>
                        {title}
                    </Heading>
                    <Text size='md' tone='secondary' lineHeight='5'>{description}</Text>
                </Stack>

                {showBack && (
                    <Button
                        variant='solid'
                        intent='brand'
                        size='sm'
                        onClick={() => navigate(-1)}
                        className='mt-05'
                    >
                        Go back
                    </Button>
                )}
            </Stack>
        </Row>
    );
};

export default AccessDenied;
