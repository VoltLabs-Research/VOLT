import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import './AccessDenied.css';
import { ShieldOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import React from 'react';

interface AccessDeniedProps {
    title?: string;
    description?: string;
    showBack?: boolean;
    className?: string;
};

const AccessDenied: React.FC<AccessDeniedProps> = ({
    title = 'Access Denied',
    description = 'You do not have permission to perform this action. Contact your team administrator to request access.',
    showBack = true,
    className
}) => {
    const navigate = useNavigate();

    return (
        <Container className={`access-denied-container d-flex items-center content-center w-max h-max ${className || ''}`}>
            <Container className='text-center d-flex column gap-1-5 items-center access-denied-content'>
                <Container className='d-flex content-center items-center access-denied-icon'>
                    <ShieldOff size={24} />
                </Container>

                <Container className='d-flex column gap-05 text-center'>
                    <span className='font-size-3 font-weight-5 color-primary'>{title}</span>
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
        </Container>
    );
};

export default AccessDenied;
