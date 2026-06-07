import UserBadge from '../UserBadge';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import { Button, Stack } from '@voltstack/bravais';
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
    <Stack gap='1'>
        <UserBadge
            label='Signing up as'
            email={email}
            onChangeClick={onBack} />
        <Stack
            as='form'
            gap='1'
            {...({ onSubmit } as React.FormHTMLAttributes<HTMLFormElement>)}
        >
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
        </Stack>
    </Stack>
);

export default RegisterStep;
