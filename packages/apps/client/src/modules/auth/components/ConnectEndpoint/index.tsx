import {
    commitBackendEndpoint,
    runLocalStack
} from '@/modules/auth/services/endpoint-session';
import {
    describeEndpointFailure,
    probeEndpointHealth
} from '@/modules/auth/services/endpoint-health';
import { hasResolvedBackendEndpoint } from '@/app/core/http/utils/backend-origin';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import { Button } from '@heroui/react';
import { sileo } from 'sileo';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'react-router-dom';
import type { FormEvent } from 'react';

const ConnectEndpointTemplate = () => {
    const [isVerifying, setIsVerifying] = useState(false);
    const [searchParams] = useSearchParams();
    // The landing's "Run in this browser" arrives as ?run=browser. It starts the in-browser stack
    // only for a browser with no server yet, so a link never takes anyone off the server they use.
    const runsInBrowser = searchParams.get('run') === 'browser' && !hasResolvedBackendEndpoint();

    useEffect(() => {
        if (runsInBrowser) runLocalStack();
    }, [runsInBrowser]);

    const { control, getValues, trigger } = useForm<{ endpoint: string }>({
        defaultValues: {
            endpoint: ''
        },
        mode: 'onTouched'
    });

    const handleSubmit = async (event?: FormEvent) => {
        event?.preventDefault();

        const isValid = await trigger('endpoint');
        if (!isValid) return;

        const { endpoint } = getValues();

        try {
            setIsVerifying(true);
            const result = await probeEndpointHealth(endpoint);

            if (!result.ok) {
                sileo.error({
                    title: 'Could not connect',
                    description: describeEndpointFailure(result.reason)
                });
                return;
            }

            sileo.success({
                title: 'Server connected',
                description: result.origin
            });
            commitBackendEndpoint(result.origin);
        } finally {
            setIsVerifying(false);
        }
    };

    // The page reloads into the in-browser stack; the form would only flash in between.
    if (runsInBrowser) return null;

    return (
        <main className='flex min-h-dvh items-center justify-center bg-background px-4 py-18' aria-labelledby='connect-form-title'>
            <div className='flex w-full max-w-sm flex-col gap-6'>
                <header className='flex flex-col gap-2'>
                    <h1 className='heading-reveal text-3xl font-semibold tracking-tight text-foreground sm:text-4xl' id='connect-form-title'>Connect to a server</h1>
                    <p className='text-base text-muted'>Enter the address of the VOLT deployment you want to work on.</p>
                </header>

                <form className='flex flex-col gap-4' onSubmit={handleSubmit}>
                    <FormFieldRHF
                        name='endpoint'
                        control={control}
                        label='Server address'
                        type='text'
                        placeholder='https://volt.your-university.edu'
                        autoFocus
                        inputProps={{
                            autoComplete: 'url',
                            inputMode: 'url',
                            spellCheck: false,
                            name: 'endpoint',
                            autoCapitalize: 'none',
                            autoCorrect: 'off'
                        }}
                    />

                    <Button
                        type='submit'
                        isPending={isVerifying}
                        variant='primary'
                        fullWidth
                    >
                        {isVerifying ? 'Verifying…' : 'Continue'}
                    </Button>
                </form>

                <div className='flex flex-col gap-3 pt-2'>
                    <p className='text-sm text-muted'>Or run VOLT entirely in this browser: the server and a compute cluster start in this tab, and your work stays on this device.</p>
                    <Button
                        variant='secondary'
                        fullWidth
                        onPress={runLocalStack}
                    >
                        Run in this browser
                    </Button>
                </div>

                <p className='text-center text-sm text-muted'>
                    Need help? Read the <a className='text-foreground underline decoration-foreground/15 underline-offset-2 transition-colors hover:decoration-current' href='https://docs.voltcloud.dev' target='_blank' rel='noreferrer'>docs</a>.
                </p>
            </div>
        </main>
    );
};

export default ConnectEndpointTemplate;
