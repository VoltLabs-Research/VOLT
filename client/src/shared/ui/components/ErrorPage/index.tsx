import { SOURCE_LABELS } from '@/shared/utils/error-routing';
import Scrollable from '@/shared/ui/components/Scrollable';
import { Button, buttonVariants } from '@heroui/react';
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
        <main className='flex flex-row items-center justify-center w-full min-h-dvh bg-background'>
            <div className='flex flex-col items-center gap-6 text-center max-w-[560px] max-md:max-w-[90%]' role='alert' aria-live='assertive'>
                <div className='flex flex-row items-center justify-center shrink-0 text-danger'>
                    <AlertTriangle size={24} aria-hidden='true' />
                </div>

                <div className='flex flex-col gap-2 text-center'>
                    <h1 className='text-base font-medium text-foreground'>
                        Something went wrong
                    </h1>
                    <p className='text-sm text-muted leading-normal'>
                        {description}
                    </p>
                    <p className='text-sm text-muted'>
                        Head back to the dashboard to continue.
                    </p>
                </div>

                {source && (
                    <section className='flex flex-col items-center gap-4 w-full' aria-label='Error details'>
                        <div className='flex flex-row items-center gap-4'>
                            <span className='inline-flex px-2.5 py-0.5 rounded-full bg-surface-tertiary text-xs text-muted'>
                                {SOURCE_LABELS[source] ?? source}
                            </span>
                            {errorTimestamp && isValid(errorTimestamp) && (
                                <span className='text-xs text-muted'>
                                    {format(errorTimestamp, 'p')}
                                </span>
                            )}
                        </div>

                        {stack && (
                            <div className='flex flex-col gap-2 w-full'>
                                <Button
                                    variant='ghost'
                                    size='sm'
                                    onPress={() => setShowStack((v) => !v)}
                                    aria-expanded={showStack}
                                >
                                    {showStack ? 'Hide' : 'Show'} details
                                    {showStack ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </Button>

                                {showStack && (
                                    /*
                                     * The chrome sits on the scroller and the <pre> stays
                                     * transparent: the fade masks whatever the scroller paints, so
                                     * a background on the inner element would dissolve along with
                                     * the text at the edges.
                                     */
                                    <Scrollable className='max-h-60 max-md:max-h-[180px] px-4 py-3 rounded-xl bg-surface-secondary border border-border'>
                                        <pre className='m-0 font-mono text-xs leading-[1.6] text-muted text-left whitespace-pre-wrap break-words'>
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
