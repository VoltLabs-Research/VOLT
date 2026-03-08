import { type Control } from 'react-hook-form';
import { ArrowLeft, Lock } from 'lucide-react';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import UserBadge from '../UserBadge';
import type { SignInForm } from '../../templates/SignIn/validation-schema';

interface PasswordStepProps {
    email: string;
    control: Control<SignInForm>;
    isLoading: boolean;
    onSubmit: React.FormEventHandler<HTMLFormElement>;
    onBack: () => void;
}

const PasswordStep = ({ email, control, isLoading, onSubmit, onBack }: PasswordStepProps) => (
    <Container className='d-flex column gap-1'>
        <UserBadge
            label='Logging in as'
            email={email}
            onChangeClick={onBack} />

        <form onSubmit={onSubmit} className='d-flex column gap-1'>
            <FormFieldRHF
                name='password'
                control={control}
                type='password'
                placeholder='Password'
                autoFocus
                icon={<Lock size={18} />}
            />

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
