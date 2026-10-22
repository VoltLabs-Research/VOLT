import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import { Button } from '@heroui/react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { UpdatePasswordInput } from '@volt/contracts/modules/auth/http';
import type { PasswordInfo } from '@volt/contracts/modules/auth/domain';

interface PasswordChangeFormProps {
    id?: string;
    passwordInfo: PasswordInfo | null;
    isOpen: boolean;
    onSubmit: (data: UpdatePasswordInput) => Promise<void>;
    onCancel: () => void;
}

const PasswordChangeForm = ({
    id,
    passwordInfo,
    isOpen,
    onSubmit,
    onCancel
}: PasswordChangeFormProps) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const { control, handleSubmit, reset, watch } = useForm({
        defaultValues: {
            currentPassword: '',
            newPassword: '',
            confirmPassword: ''
        },
        mode: 'onBlur'
    });

    useEffect(() => {
        const subscription = watch(() => {
            if (submitError) {
                setSubmitError(null);
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [submitError, watch]);

    if (!isOpen) return null;

    const onFormSubmit = handleSubmit(async (data) => {
        try {
            setIsSubmitting(true);
            setSubmitError(null);
            await onSubmit({
                passwordCurrent: passwordInfo?.hasPassword ? data.currentPassword : undefined,
                password: data.newPassword
            });
            reset();
        } catch (error: unknown) {
            let errorMessage = 'Failed to change password';

            if (error instanceof Error) {
                errorMessage = error.message;
            }

            setSubmitError(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    });

    const handleCancel = () => {
        reset();
        setSubmitError(null);
        onCancel();
    };

    return (
        <form id={id} className='flex flex-col gap-4 rounded-2xl bg-foreground/4 p-5' onSubmit={onFormSubmit} noValidate>
            {passwordInfo?.hasPassword && (
                <FormFieldRHF
                    name='currentPassword'
                    control={control}
                    label='Current Password'
                    type='password'
                    placeholder='Enter your current password'
                    inputProps={{
                        autoComplete: 'current-password',
                        inputMode: 'text',
                        spellCheck: false,
                        name: 'currentPassword',
                        autoCapitalize: 'none',
                        autoCorrect: 'off'
                    }}
                />
            )}

            <FormFieldRHF
                name='newPassword'
                control={control}
                label='New Password'
                type='password'
                placeholder='Enter new password (min. 8 characters)'
                inputProps={{
                    autoComplete: 'new-password',
                    inputMode: 'text',
                    spellCheck: false,
                    name: 'newPassword',
                    autoCapitalize: 'none',
                    autoCorrect: 'off'
                }}
            />
            <FormFieldRHF
                name='confirmPassword'
                control={control}
                label='Confirm New Password'
                type='password'
                placeholder='Confirm your new password'
                inputProps={{
                    autoComplete: 'new-password',
                    inputMode: 'text',
                    spellCheck: false,
                    name: 'confirmPassword',
                    autoCapitalize: 'none',
                    autoCorrect: 'off'
                }}
            />

            {submitError && (
                <p className='text-xs text-danger-soft-foreground' role='status' aria-live='polite'>
                    {submitError}
                </p>
            )}

            <div className='flex flex-wrap justify-end gap-2'>
                <Button
                    type='button'
                    variant='secondary'
                    size='sm'
                    onPress={handleCancel}
                >
                    Cancel
                </Button>
                <Button
                    type='submit'
                    variant='primary'
                    size='sm'
                    isPending={isSubmitting}
                    isDisabled={isSubmitting}
                >
                    {passwordInfo?.hasPassword ? 'Change Password' : 'Set Password'}
                </Button>
            </div>
        </form>
    );
};

export default PasswordChangeForm;
