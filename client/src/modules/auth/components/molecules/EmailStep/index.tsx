import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import GoogleIcon from '@/shared/presentation/components/icons/GoogleIcon';
import MicrosoftIcon from '@/shared/presentation/components/icons/MicrosoftIcon';
import { Github, Mail } from 'lucide-react';
import type { FormEventHandler, ReactNode } from 'react';
import type { Control } from 'react-hook-form';
import type { SignInForm } from '../../templates/SignIn/validation-schema';

interface OAuthProvider {
    key: string;
    label: string;
    icon: ReactNode;
};

interface EmailStepProps {
    control: Control<SignInForm>;
    isLoading: boolean;
    onSubmit: FormEventHandler<HTMLFormElement>;
    onOAuth: (provider: string) => void;
};

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

const EmailStep = ({ control, isLoading, onSubmit, onOAuth }: EmailStepProps) => (
    <Container className='d-flex column gap-1'>
        <Container className='d-flex column gap-1'>
            {oauthProviders.map(({ key, label, icon }) => (
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
        </Container>

        <Container className='d-flex items-center sign-in-divider font-size-1'>
            <span>Or continue with email</span>
        </Container>

        <form onSubmit={onSubmit} className='d-flex column gap-1'>
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
        </form>
    </Container>
);

export default EmailStep;
