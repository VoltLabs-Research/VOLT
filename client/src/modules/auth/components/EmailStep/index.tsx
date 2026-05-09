import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import GoogleIcon from '@/modules/auth/components/icons/GoogleIcon';
import MicrosoftIcon from '@/modules/auth/components/icons/MicrosoftIcon';
import Button from '@/shared/presentation/primitives/Button';
import Row from '@/shared/presentation/primitives/Row';
import Stack from '@/shared/presentation/primitives/Stack';
import { Github, Mail } from 'lucide-react';
import type { FormEventHandler, ReactNode } from 'react';
import type { Control } from 'react-hook-form';
import type { OAuthProviderKey } from '@/modules/auth/api/service';
import type { SignInForm } from '../SignIn/validation-schema';

interface OAuthProvider {
    key: OAuthProviderKey;
    label: string;
    icon: ReactNode;
}

interface EmailStepProps {
    control: Control<SignInForm>;
    isLoading: boolean;
    onSubmit: FormEventHandler<HTMLFormElement>;
    onOAuth: (provider: OAuthProviderKey) => void;
    availableProviders: OAuthProviderKey[];
}

const oauthProviders: OAuthProvider[] = [{
    key: 'github',
    label: 'GitHub',
    icon: <Github size={20} />
}, {
    key: 'google',
    label: 'Google',
    icon: <GoogleIcon />
}, {
    key: 'microsoft',
    label: 'Microsoft',
    icon: <MicrosoftIcon />
}];

const EmailStep = ({ control, isLoading, onSubmit, onOAuth, availableProviders }: EmailStepProps) => {
    const visibleProviders = oauthProviders.filter((provider) => availableProviders.includes(provider.key));
    const hasOAuth = visibleProviders.length > 0;

    return (
    <Stack gap='1'>
        {hasOAuth && (
            <>
                <Stack gap='1'>
                    {visibleProviders.map(({ key, label, icon }) => (
                        <Button
                            key={key}
                            variant='outline'
                            intent='neutral'
                            block
                            leftIcon={icon}
                            onClick={() => onOAuth(key)}>
                            Continue with {label}
                        </Button>
                    ))}
                </Stack>

                <Row className='sign-in-divider text-eyebrow'>
                    <span>Or continue with email</span>
                </Row>
            </>
        )}

        <Stack
            as='form'
            gap='1'
            {...({ onSubmit } as React.FormHTMLAttributes<HTMLFormElement>)}
        >
            <FormFieldRHF
                name='email'
                control={control}
                label='Email address'
                type='email'
                placeholder='name@example.com'
                autoFocus
                icon={<Mail size={18} />}
                inputProps={{
                    autoComplete: 'email',
                    inputMode: 'email',
                    spellCheck: false,
                    name: 'email',
                    autoCapitalize: 'none',
                    autoCorrect: 'off'
                }}
            />

            <Button
                type='submit'
                isLoading={isLoading}
                variant='solid'
                intent='brand'
                block
            >
                Continue with Email
            </Button>
        </Stack>
    </Stack>
    );
};

export default EmailStep;
