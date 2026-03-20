import './PasswordChangeForm.css';
import { passwordChangeSchema } from './validation-schema';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import WarningZone from '@/shared/presentation/components/WarningZone';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Lock, Key } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { ChangePasswordInputDTO } from '@/modules/auth/api/dtos/change-password';
import type { PasswordChangeForm as PasswordChangeFormType, PasswordInfo } from './validation-schema';

interface PasswordChangeFormProps {
    passwordInfo: PasswordInfo | null;
    isOpen: boolean;
    onSubmit: (data: ChangePasswordInputDTO) => Promise<void>;
    onCancel: () => void;
};

const PasswordChangeForm = ({
    passwordInfo,
    isOpen,
    onSubmit,
    onCancel
}: PasswordChangeFormProps) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const { control, handleSubmit, reset, watch } = useForm<PasswordChangeFormType>({
        resolver: zodResolver(passwordChangeSchema),
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
        <form className='password-form d-flex column gap-3 p-4 b-soft radius-md p-1-5' onSubmit={onFormSubmit} noValidate>
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
                <WarningZone
                    icon={<AlertCircle size={16} />}
                    message={submitError}
                    className='password-form-error' />
            )}

            <Container className='d-flex gap-075 flex-wrap'>
                <Button
                    type='submit'
                    intent='brand'
                    isLoading={isSubmitting}
                    disabled={isSubmitting}
                >
                    {passwordInfo?.hasPassword ? 'Change Password' : 'Set Password'}
                </Button>
                <Button
                    type='button'
                    variant='ghost'
                    onClick={handleCancel}
                >
                    Cancel
                </Button>
            </Container>
        </form>
    );
};

export default PasswordChangeForm;
