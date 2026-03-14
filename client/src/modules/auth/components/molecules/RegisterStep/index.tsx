import UserBadge from '../UserBadge';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import { ArrowLeft } from 'lucide-react';
import type { FormEventHandler } from 'react';
import type { Control } from 'react-hook-form';
import type { SignInForm } from '../../templates/SignIn/validation-schema';

interface RegisterStepProps {
    email: string;
    control: Control<SignInForm>;
    isLoading: boolean;
    onSubmit: FormEventHandler<HTMLFormElement>;
    onBack: () => void;
};

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
                label='Full name'
                placeholder='Full Name'
                inputProps={{
                    autoComplete: 'name',
                    inputMode: 'text',
                    spellCheck: false,
                    name: 'fullName'
                }}
            />
            <FormFieldRHF
                name='password'
                control={control}
                label='Password'
                type='password'
                placeholder='Password'
                inputProps={{
                    autoComplete: 'new-password',
                    inputMode: 'text',
                    spellCheck: false,
                    name: 'password',
                    autoCapitalize: 'none',
                    autoCorrect: 'off'
                }}
            />
            <FormFieldRHF
                name='passwordConfirm'
                control={control}
                label='Confirm password'
                type='password'
                placeholder='Confirm Password'
                inputProps={{
                    autoComplete: 'new-password',
                    inputMode: 'text',
                    spellCheck: false,
                    name: 'passwordConfirm',
                    autoCapitalize: 'none',
                    autoCorrect: 'off'
                }}
            />
            <Button
                type='submit'
                isLoading={isLoading}
                variant='solid'
                intent='brand'
                block>
                Create Account
            </Button>
            <Button
                variant='ghost'
                intent='neutral'
                block
                leftIcon={<ArrowLeft size={16} />}
                onClick={onBack}>
                Back
            </Button>
        </form>
    </Container>
);

export default RegisterStep;
