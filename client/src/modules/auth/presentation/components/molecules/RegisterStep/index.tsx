import { ArrowLeft } from 'lucide-react';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import FormField from '@/shared/presentation/components/FormField';
import UserBadge from '../UserBadge';

interface RegisterStepProps{
    email: string;
    fullNameField: React.ComponentProps<typeof FormField>;
    passwordField: React.ComponentProps<typeof FormField>;
    passwordConfirmField: React.ComponentProps<typeof FormField>;
    isLoading: boolean;
    onSubmit: React.FormEventHandler<HTMLFormElement>;
    onBack: () => void;
};

const RegisterStep = ({ 
    email, 
    fullNameField, 
    passwordField, 
    passwordConfirmField, 
    isLoading, 
    onSubmit, 
    onBack 
}: RegisterStepProps) => (
    <Container className='d-flex column gap-1'>
        <UserBadge 
            label='Signing up as' 
            email={email} 
            onChangeClick={onBack} />
        <form onSubmit={onSubmit} className='d-flex column gap-1'>
            <FormField 
                placeholder='Full Name' 
                {...fullNameField} />
            <FormField 
                type='password' 
                placeholder='Password' 
                {...passwordField} />
            <FormField 
                type='password' 
                placeholder='Confirm Password' 
                {...passwordConfirmField} />
            <Button 
                type='submit' 
                isLoading={isLoading} 
                variant='solid' 
                intent='white' 
                block>
                Create Account
            </Button>
            <Button 
                variant='ghost' 
                intent='white' 
                block 
                leftIcon={<ArrowLeft size={16} />} 
                onClick={onBack}>
                Back
            </Button>
        </form>
    </Container>
);

export default RegisterStep;
