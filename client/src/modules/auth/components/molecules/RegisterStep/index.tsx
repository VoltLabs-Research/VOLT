import { type Control } from 'react-hook-form';
import { ArrowLeft } from 'lucide-react';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import UserBadge from '../UserBadge';
import type { SignInForm } from '../../templates/SignIn/validation-schema';

interface RegisterStepProps {
    email: string;
    control: Control<SignInForm>;
    isLoading: boolean;
    onSubmit: React.FormEventHandler<HTMLFormElement>;
    onBack: () => void;
}

const RegisterStep = ({
    email,
    control,
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
            <FormFieldRHF
                name='fullName'
                control={control}
                placeholder='Full Name'
            />
            <FormFieldRHF
                name='password'
                control={control}
                type='password'
                placeholder='Password'
            />
            <FormFieldRHF
                name='passwordConfirm'
                control={control}
                type='password'
                placeholder='Confirm Password'
            />
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
