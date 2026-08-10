import './ConnectEndpoint.css';
import {
    commitBackendEndpoint
} from '@/modules/auth/services/endpoint-session';
import {
    describeEndpointFailure,
    probeEndpointHealth
} from '@/modules/auth/services/endpoint-health';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import { Button, Stack } from '@voltstack/bravais';
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
        <main className='connect-page screen-vh'>
            <section className='flex flex-col justify-center p-6 connect-form-shell screen-vh' aria-labelledby='connect-form-title'>
                <div className='flex flex-col gap-8 w-full connect-form-section'>
                    <header className='flex flex-col gap-2'>
                        <h1 className='text-base font-medium text-foreground connect-form-title' id='connect-form-title'>Connect to a server</h1>
                        <p>Enter the address of the VOLT deployment you want to work on.</p>
                    </header>

                    <Stack
                        as='form'
                        gap='1'
                        {...({ onSubmit: handleSubmit } as React.FormHTMLAttributes<HTMLFormElement>)}
                    >
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
                            isLoading={isVerifying}
                            variant='solid'
                            intent='brand'
                            block
                        >
                            {isVerifying ? 'Verifying…' : 'Continue'}
                        </Button>
                    </Stack>

                    <p className='text-center connect-hint'>
                        Need help? Read the <a href='https://docs.voltcloud.dev' target='_blank' rel='noreferrer'>docs</a>.
                    </p>
                </div>
            </section>
        </main>
    );
};

export default ConnectEndpointTemplate;
