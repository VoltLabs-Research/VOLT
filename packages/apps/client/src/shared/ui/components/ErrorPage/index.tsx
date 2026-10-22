import { SOURCE_LABELS } from '@/shared/utils/error-routing';
import Scrollable from '@/shared/ui/components/Scrollable';
import { Button, Chip, buttonVariants } from '@heroui/react';
import { format, isValid } from 'date-fns';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

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
        <main className='flex flex-row items-center justify-center w-full min-h-dvh bg-canvas px-4 py-18'>
            <div className='flex flex-col items-center gap-5 text-center w-full max-w-md' role='alert' aria-live='assertive'>
                <AlertTriangle size={28} className='shrink-0 text-danger' aria-hidden='true' />

                <div className='flex flex-col gap-2 text-center'>
                    <h1 className='text-2xl font-semibold tracking-tight text-foreground'>
                        Something went wrong
                    </h1>
                    <p className='text-sm text-muted text-pretty'>
                        {description} Head back to the dashboard to continue.
                    </p>
                </div>

                {source && (
                    <section className='flex flex-col items-center gap-5 w-full' aria-label='Error details'>
                        <div className='flex flex-row items-center gap-3'>
                            <Chip>
                                <Chip.Label>{SOURCE_LABELS[source] ?? source}</Chip.Label>
                            </Chip>
                            {errorTimestamp && isValid(errorTimestamp) && (
                                <span className='text-xs text-muted'>
                                    {format(errorTimestamp, 'p')}
                                </span>
                            )}
                        </div>

                        {stack && (
                            <div className='flex flex-col items-center gap-5 w-full'>
                                <Button
                                    variant='ghost'
                                    size='sm'
                                    onPress={() => setShowStack((v) => !v)}
                                    aria-expanded={showStack}
                                >
                                    {showStack ? 'Hide' : 'Show'} details
                                    {showStack ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </Button>

                                {showStack && (
                                    <Scrollable className='w-full max-h-56 px-4 py-3 rounded-xl bg-foreground/4'>
                                        <pre className='m-0 font-mono text-xs leading-relaxed text-muted text-left whitespace-pre-wrap break-words'>
                                            {stack}
                                        </pre>
                                    </Scrollable>
                                )}
                            </div>
                        )}
                    </section>
                )}

                <Link
                    to='/dashboard'
                    className={buttonVariants({ variant: 'primary', size: 'sm' })}
                >
                    Back to dashboard
                </Link>
            </div>
        </main>
    );
};

export default ErrorPage;
