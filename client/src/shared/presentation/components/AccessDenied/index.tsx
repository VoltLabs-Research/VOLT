import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import './AccessDenied.css';
import { ShieldOff } from 'lucide-react';
import { useId } from 'react';
import { useNavigate } from 'react-router-dom';

interface AccessDeniedProps {
    title?: string;
    description?: string;
    showBack?: boolean;
    className?: string;
};

const AccessDenied = ({
    title = 'Access Denied',
    description = 'You do not have permission to perform this action. Contact your team administrator to request access.',
    showBack = true,
    className
}: AccessDeniedProps) => {
    const navigate = useNavigate();
    const headingId = useId();

    return (
        <section aria-labelledby={headingId} className={`access-denied-container d-flex items-center content-center w-max h-max ${className || ''}`}>
            <Container className='text-center d-flex column gap-1-5 items-center access-denied-content'>
                <Container className='d-flex content-center items-center access-denied-icon'>
                    <ShieldOff size={24} />
                </Container>

                <Container className='d-flex column gap-05 text-center'>
                    <Title as='h2' id={headingId} className='font-size-3 font-weight-5 color-primary'>
                        {title}
                    </Title>
                    <span className='font-size-2 color-secondary line-height-5'>{description}</span>
                </Container>

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
            </Container>
        </section>
    );
};

export default AccessDenied;
