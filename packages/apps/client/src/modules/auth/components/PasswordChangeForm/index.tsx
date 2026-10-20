import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import { Alert, Button } from '@heroui/react';
import { AlertCircle, Lock, Key } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { UpdatePasswordInput } from '@volt/contracts/modules/auth/http';
import type { PasswordInfo } from '@volt/contracts/modules/auth/domain';

interface PasswordChangeFormProps {
    passwordInfo: PasswordInfo | null;
    isOpen: boolean;
    onSubmit: (data: UpdatePasswordInput) => Promise<void>;
    onCancel: () => void;
}

const PasswordChangeForm = ({
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
        <form className='flex flex-col gap-12 border border-border rounded-xl p-6' onSubmit={onFormSubmit} noValidate>
            {passwordInfo?.hasPassword && (
                <FormFieldRHF
                    name='currentPassword'
                    control={control}
                    label='Current Password'
                    type='password'
                    placeholder='Enter your current password'
                    icon={<Key size={18} />}
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
                icon={<Lock size={18} />}
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
                icon={<Lock size={18} />}
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
                <Alert
                    status='warning'
                    role='status'
                    aria-live='polite'
                    className='-mt-2'
                >
                    <Alert.Indicator>
                        <AlertCircle size={16} />
                    </Alert.Indicator>
                    <Alert.Content>
                        <Alert.Description>{submitError}</Alert.Description>
                    </Alert.Content>
                </Alert>
            )}

            <div className='flex flex-wrap gap-3'>
                <Button
                    type='submit'
                    variant='primary'
                    isPending={isSubmitting}
                    isDisabled={isSubmitting}
                >
                    {passwordInfo?.hasPassword ? 'Change Password' : 'Set Password'}
                </Button>
                <Button
                    type='button'
                    variant='ghost'
                    onPress={handleCancel}
                >
                    Cancel
                </Button>
            </div>
        </form>
    );
};

export default PasswordChangeForm;
