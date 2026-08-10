import UserBadge from '../UserBadge';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import { Button } from '@heroui/react';
import { ArrowLeft } from 'lucide-react';
import type { FormEventHandler } from 'react';
import type { Control } from 'react-hook-form';
import type { SignInForm } from '../SignIn/validation-schema';

interface RegisterStepProps {
    email: string;
    control: Control<SignInForm>;
    isLoading: boolean;
    onSubmit: FormEventHandler<HTMLFormElement>;
    onBack: () => void;
}

const RegisterStep = ({
    email,
    control,
    isLoading,
    onSubmit,
    onBack
}: RegisterStepProps) => (
    <div className='flex flex-col gap-4'>
        <UserBadge
            label='Signing up as'
            email={email}
            onChangeClick={onBack} />
        <form className='flex flex-col gap-4' onSubmit={onSubmit}>
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
                isPending={isLoading}
                variant='primary'
                fullWidth>
                Create Account
            </Button>
            <Button
                variant='ghost'
                fullWidth
                onPress={onBack}>
                <ArrowLeft size={16} />
                Back
            </Button>
        </form>
    </div>
);

export default RegisterStep;
