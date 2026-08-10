import {
    commitBackendEndpoint
} from '@/modules/auth/services/endpoint-session';
import {
    describeEndpointFailure,
    probeEndpointHealth
} from '@/modules/auth/services/endpoint-health';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import { Button } from '@heroui/react';
import { sileo } from 'sileo';
import { Server } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { FormEvent } from 'react';

const ConnectEndpointTemplate = () => {
    const [isVerifying, setIsVerifying] = useState(false);

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

    return (
        <main className='min-h-dvh bg-background'>
            <section className='relative flex min-h-dvh flex-col justify-center bg-background p-6 max-sm:p-4' aria-labelledby='connect-form-title'>
                <div className='mx-auto flex w-full max-w-[26rem] flex-col gap-8'>
                    <header className='flex flex-col gap-2'>
                        <h1 className='text-[2rem] font-bold tracking-[-0.03em] text-foreground max-lg:text-[1.75rem]' id='connect-form-title'>Connect to a server</h1>
                        <p>Enter the address of the VOLT deployment you want to work on.</p>
                    </header>

                    <form className='flex flex-col gap-4' onSubmit={handleSubmit}>
                        <FormFieldRHF
                            name='endpoint'
                            control={control}
                            label='Server address'
                            type='text'
                            placeholder='https://volt.your-university.edu'
                            autoFocus
                            icon={<Server size={18} />}
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

                    <p className='border-t border-border/70 pt-2 text-center text-sm leading-[1.6] text-muted'>
                        Need help? Read the <a href='https://docs.voltcloud.dev' target='_blank' rel='noreferrer'>docs</a>.
                    </p>
                </div>
            </section>
        </main>
    );
};

export default ConnectEndpointTemplate;
