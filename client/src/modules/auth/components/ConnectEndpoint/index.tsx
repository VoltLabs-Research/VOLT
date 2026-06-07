import './ConnectEndpoint.css';
import { connectEndpointSchema } from './validation-schema';
import {
    commitBackendEndpoint
} from '@/modules/auth/services/endpoint-session';
import {
    describeEndpointFailure,
    probeEndpointHealth
} from '@/modules/auth/services/endpoint-health';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import Button from '@/shared/presentation/primitives/Button';
import Heading from '@/shared/presentation/primitives/Heading';
import Stack from '@/shared/presentation/primitives/Stack';
import Text from '@/shared/presentation/primitives/Text';
import { sileo } from 'sileo';
import { Server } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { FormEvent } from 'react';
import type { ConnectEndpointForm } from './validation-schema';

const ConnectEndpointTemplate = () => {
    const [isVerifying, setIsVerifying] = useState(false);

    const { control, getValues, trigger } = useForm<ConnectEndpointForm>({
        resolver: zodResolver(connectEndpointSchema),
        defaultValues: {
            endpoint: window.location.origin
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
            <Stack as='section' justify='center' p='1-5' className='connect-form-shell screen-vh' aria-labelledby='connect-form-title'>
                <Stack gap='2' width='max' className='connect-form-section'>
                    <Stack as='header' gap='05'>
                        <Heading level={1} id='connect-form-title' className='connect-form-title'>Connect to a server</Heading>
                        <Text as='p'>Enter the address of the VOLT deployment you want to work on.</Text>
                    </Stack>

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

                    <Text as='p' align='center' className='connect-hint'>
                        Your workspace data lives on the server you connect to. You can change servers later from the sign in screen.
                    </Text>
                </Stack>
            </Stack>
        </main>
    );
};

export default ConnectEndpointTemplate;
