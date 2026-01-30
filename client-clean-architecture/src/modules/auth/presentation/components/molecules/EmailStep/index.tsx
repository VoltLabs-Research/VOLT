import { ReactNode } from 'react';
import { Github, Mail } from 'lucide-react';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import FormField from '@/shared/presentation/components/FormField';
import GoogleIcon from '@/shared/presentation/components/icons/GoogleIcon';
import MicrosoftIcon from '@/shared/presentation/components/icons/MicrosoftIcon';

interface OAuthProvider{
    key: string;
    label: string;
    icon: ReactNode;
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

interface EmailStepProps{
    emailField: React.ComponentProps<typeof FormField>;
    isLoading: boolean;
    onSubmit: React.FormEventHandler<HTMLFormElement>;
    onOAuth: (provider: string) => void;
};

const EmailStep = ({ emailField, isLoading, onSubmit, onOAuth }: EmailStepProps) => (
    <Container className='d-flex column gap-1'>
        <Container className='d-flex column gap-1'>
            {oauthProviders.map(({ key, label, icon }) => (
                <Button
                    key={key}
                    variant='outline'
                    intent='white'
                    size='lg'
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
            <FormField 
                type='email' 
                placeholder='name@example.com' 
                autoFocus 
                icon={<Mail size={18} />} 
                {...emailField} />

            <Button 
                type='submit' 
                isLoading={isLoading} 
                variant='solid' 
                intent='white' 
                block
            >
                Continue
            </Button>
        </form>
    </Container>
);

export default EmailStep;
