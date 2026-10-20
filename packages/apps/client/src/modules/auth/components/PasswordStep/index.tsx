import UserBadge from '../UserBadge';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import { Button } from '@heroui/react';
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
}

const PasswordStep = ({ email, control, isLoading, onSubmit, onBack }: PasswordStepProps) => (
    <div className='flex flex-col gap-4'>
        <UserBadge
            label='Logging in as'
            email={email}
            onChangeClick={onBack} />

        <form className='flex flex-col gap-4' onSubmit={onSubmit}>
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
                isPending={isLoading}
                variant='primary'
                fullWidth
            >
                Sign In
            </Button>

            <Button
                variant='ghost'
                fullWidth
                onPress={onBack}
            >
                <ArrowLeft size={16} />
                Back
            </Button>
        </form>
    </div>
);

export default PasswordStep;
