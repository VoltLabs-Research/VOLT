import { SOURCE_LABELS } from '@/shared/utils/error-routing';
import Button from '@/shared/presentation/primitives/Button';
import Row from '@/shared/presentation/primitives/Row';
import Stack from '@/shared/presentation/primitives/Stack';
import './ErrorPage.css';
import { format, isValid } from 'date-fns';
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
    const errorTimestamp = timestamp ? new Date(Number(timestamp)) : null;

    return (
        <main className='error-page d-flex items-center content-center w-max'>
            <Stack align='center' gap='1-5' textAlign='center' className='error-page-content' role='alert' aria-live='assertive'>
                <Row justify='center' className='error-page-icon'>
                    <AlertTriangle size={24} aria-hidden='true' />
                </Row>

                <Stack gap='05' textAlign='center'>
                    <h1 className='font-size-3 font-weight-5 color-primary error-page-title'>
                        Something went wrong
                    </h1>
                    <p className='font-size-2 color-secondary line-height-5 error-page-description'>
                        {description}
                    </p>
                    <p className='font-size-2 color-muted error-page-description'>
                        Head back to the dashboard to continue.
                    </p>
                </Stack>

                {source && (
                    <Stack as='section' gap='1' align='center' width='max' aria-label='Error details'>
                        <Row gap='1'>
                            <span className='error-page-source'>
                                {SOURCE_LABELS[source] ?? source}
                            </span>
                            {errorTimestamp && isValid(errorTimestamp) && (
                                <span className='error-page-timestamp'>
                                    {format(errorTimestamp, 'p')}
                                </span>
                            )}
                        </Row>

                        {stack && (
                            <Stack gap='05' width='max'>
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
                            </Stack>
                        )}
                    </Stack>
                )}

                <Button
                    variant='solid'
                    intent='brand'
                    size='sm'
                    to='/dashboard'
                >
                    Back to dashboard
                </Button>
            </Stack>
        </main>
    );
};

export default ErrorPage;
