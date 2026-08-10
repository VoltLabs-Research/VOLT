import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import GoogleIcon from '@/modules/auth/components/icons/GoogleIcon';
import MicrosoftIcon from '@/modules/auth/components/icons/MicrosoftIcon';
import { Button, Stack } from '@voltstack/bravais';
import { Github, Mail } from 'lucide-react';
import type { FormEventHandler, ReactNode } from 'react';
import type { Control } from 'react-hook-form';
import type { OAuthProviderId } from '@volt/contracts/modules/auth/domain';
import type { SignInForm } from '../SignIn/validation-schema';

interface OAuthProvider {
    key: OAuthProviderId;
    label: string;
    icon: ReactNode;
}

interface EmailStepProps {
    control: Control<SignInForm>;
    isLoading: boolean;
    onSubmit: FormEventHandler<HTMLFormElement>;
    onOAuth: (provider: OAuthProviderId) => void;
    availableProviders: OAuthProviderId[];
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

    return (
    <div className='flex flex-col gap-4'>
        {visibleProviders.length > 0 && (
            <>
                <div className='flex flex-col gap-4'>
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
                </div>

                <div className='flex flex-row items-center sign-in-divider text-xs font-semibold uppercase tracking-[0.05em] text-muted'>
                    <span>Or continue with email</span>
                </div>
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
    </div>
    );
};

export default EmailStep;
