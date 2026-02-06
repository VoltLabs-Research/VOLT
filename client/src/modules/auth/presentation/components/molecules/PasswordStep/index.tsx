import { ArrowLeft, Lock } from 'lucide-react';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import FormField from '@/shared/presentation/components/FormField';
import UserBadge from '../UserBadge';

interface PasswordStepProps{
    email: string;
    passwordField: React.ComponentProps<typeof FormField>;
    isLoading: boolean;
    onSubmit: React.FormEventHandler<HTMLFormElement>;
    onBack: () => void;
};

const PasswordStep = ({ email, passwordField, isLoading, onSubmit, onBack }: PasswordStepProps) => (
    <Container className='d-flex column gap-1'>
        <UserBadge 
            label='Logging in as' 
            email={email} 
            onChangeClick={onBack} />
            
        <form onSubmit={onSubmit} className='d-flex column gap-1'>
            <FormField 
                type='password' 
                placeholder='Password'
                autoFocus 
                icon={<Lock size={18} />} 
                {...passwordField} />

            <Button 
                type='submit' 
                isLoading={isLoading} 
                variant='solid' 
                intent='white' 
                block
            >
                Sign In
            </Button>

            <Button 
                variant='ghost' 
                intent='white' 
                block 
                leftIcon={<ArrowLeft size={16} />} 
                onClick={onBack}
            >
                Back
            </Button>
        </form>
    </Container>
);

export default PasswordStep;
