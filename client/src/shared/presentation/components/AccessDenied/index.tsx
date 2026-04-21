import Button from '@/shared/presentation/components/Button';
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
    const HeadingTag = headingLevel;

    return (
        <section aria-labelledby={headingId} className={`access-denied-container d-flex items-center content-center w-max h-max ${className || ''}`}>
            <div className='volt-container text-center d-flex column gap-1-5 items-center access-denied-content'>
                <div className='volt-container d-flex content-center items-center access-denied-icon'>
                    <ShieldOff size={24} />
                </div>

                <div className='volt-container d-flex column gap-05 text-center'>
                    <HeadingTag id={headingId} className='volt-title font-size-3 font-weight-5 color-primary'>
                        {title}
                    </HeadingTag>
                    <span className='font-size-2 color-secondary line-height-5'>{description}</span>
                </div>

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
            </div>
        </section>
    );
};

export default AccessDenied;
