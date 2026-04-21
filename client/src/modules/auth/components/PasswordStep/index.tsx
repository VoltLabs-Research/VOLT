import UserBadge from '../UserBadge';
import Button from '@/shared/presentation/components/Button';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import { ArrowLeft, Lock } from 'lucide-react';
import type { FormEventHandler } from 'react';
import type { Control } from 'react-hook-form';
import type { SignInForm } from '../SignIn/validation-schema';

interface PasswordStepProps {
    email: string;
    control: Control<SignInForm>;
    isLoading: boolean;
    onSubmit: FormEventHandler<HTMLFormElement>;
    onBack: () => void;
};

const PasswordStep = ({ email, control, isLoading, onSubmit, onBack }: PasswordStepProps) => (
    <div className='volt-container d-flex column gap-1'>
        <UserBadge
            label='Logging in as'
            email={email}
            onChangeClick={onBack} />

        <form onSubmit={onSubmit} className='d-flex column gap-1'>
            <FormFieldRHF
                name='password'
                control={control}
                label='Password'
                type='password'
                placeholder='Password'
                autoFocus
                icon={<Lock size={18} />}
                inputProps={{
                    autoComplete: 'current-password',
                    inputMode: 'text',
                    spellCheck: false,
                    name: 'password',
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
                Sign In
            </Button>

            <Button
                variant='ghost'
                intent='neutral'
                block
                leftIcon={<ArrowLeft size={16} />}
                onClick={onBack}
            >
                Back
            </Button>
        </form>
    </div>
);

export default PasswordStep;
