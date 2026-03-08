import { SOURCE_LABELS } from '@/shared/utils';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import './ErrorPage.css';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const ErrorPage = () => {
    const [params] = useSearchParams();
    const [showStack, setShowStack] = useState(false);

    const message = params.get('message');
    const source = params.get('source');
    const stack = params.get('stack');
    const timestamp = params.get('t');

    return (
        <Container className='error-page d-flex items-center content-center w-max'>
            <Container className='error-page-content d-flex column gap-1-5 items-center text-center'>
                <Container className='error-page-icon d-flex items-center content-center'>
                    <AlertTriangle size={24} />
                </Container>

                <Container className='d-flex column gap-05 text-center'>
                    <span className='font-size-3 font-weight-5 color-primary'>
                        Something went wrong
                    </span>
                    <span className='font-size-2 color-secondary line-height-5'>
                        {message || 'An unexpected error occurred. Please try again.'}
                    </span>
                </Container>

                {source && (
                    <Container className='d-flex column gap-1 items-center w-max'>
                        <Container className='d-flex gap-1 items-center'>
                            <span className='error-page-source'>
                                {SOURCE_LABELS[source] ?? source}
                            </span>
                            {timestamp && (
                                <span className='error-page-timestamp'>
                                    {new Date(Number(timestamp)).toLocaleTimeString()}
                                </span>
                            )}
                        </Container>

                        {stack && (
                            <Container className='d-flex column gap-05 w-max'>
                                <Button
                                    variant='ghost'
                                    intent='neutral'
                                    size='sm'
                                    onClick={() => setShowStack((v) => !v)}
                                    rightIcon={showStack ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                >
                                    {showStack ? 'Hide' : 'Show'} details
                                </Button>

                                {showStack && (
                                    <Container className='error-page-stack'>
                                        {stack}
                                    </Container>
                                )}
                            </Container>
                        )}
                    </Container>
                )}

                <Button
                    variant='solid'
                    intent='brand'
                    size='sm'
                    to='/dashboard'
                    className='mt-05'
                >
                    Back to dashboard
                </Button>
            </Container>
        </Container>
    );
};

export default ErrorPage;
