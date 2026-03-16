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
    const description = message || 'An unexpected error occurred. Please try again.';

    return (
        <main className='error-page d-flex items-center content-center w-max'>
            <Container className='error-page-content d-flex column gap-1-5 items-center text-center' role='alert' aria-live='assertive'>
                <Container className='error-page-icon d-flex items-center content-center'>
                    <AlertTriangle size={24} aria-hidden='true' />
                </Container>

                <Container className='d-flex column gap-05 text-center'>
                    <h1 className='font-size-3 font-weight-5 color-primary error-page-title'>
                        Something went wrong
                    </h1>
                    <p className='font-size-2 color-secondary line-height-5 error-page-description'>
                        {description}
                    </p>
                    <p className='font-size-2 color-muted error-page-description'>
                        Head back to the dashboard to continue.
                    </p>
                </Container>

                {source && (
                    <section className='d-flex column gap-1 items-center w-max' aria-label='Error details'>
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
                                    aria-expanded={showStack}
                                >
                                    {showStack ? 'Hide' : 'Show'} details
                                </Button>

                                {showStack && (
                                    <pre className='error-page-stack'>
                                        {stack}
                                    </pre>
                                )}
                            </Container>
                        )}
                    </section>
                )}

                <Button
                    variant='solid'
                    intent='brand'
                    size='sm'
                    to='/dashboard'
                >
                    Back to dashboard
                </Button>
            </Container>
        </main>
    );
};

export default ErrorPage;
