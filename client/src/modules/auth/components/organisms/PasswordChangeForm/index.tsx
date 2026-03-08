import React, { useState } from 'react';
import Container from '@/shared/presentation/components/Container';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import Button from '@/shared/presentation/components/Button';
import useZodForm from '@/shared/presentation/hooks/use-zod-form';
import { passwordChangeSchema, type PasswordChangeForm as PasswordChangeFormType, type PasswordInfo } from './validation-schema';
import { Lock, Key } from 'lucide-react';
import './PasswordChangeForm.css';

interface PasswordChangeFormProps {
    passwordInfo: PasswordInfo | null;
    isOpen: boolean;
    onSubmit: (data: { passwordCurrent?: string; password: string }) => Promise<void>;
    onCancel: () => void;
}

const PasswordChangeForm: React.FC<PasswordChangeFormProps> = ({
    passwordInfo,
    isOpen,
    onSubmit,
    onCancel
}) => {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { control, handleSubmit, reset, setError } = useZodForm<PasswordChangeFormType>({
        schema: passwordChangeSchema,
        defaultValues: {
            currentPassword: '',
            newPassword: '',
            confirmPassword: ''
        },
        mode: 'onBlur'
    });

    if (!isOpen) return null;

    const onFormSubmit = handleSubmit(async (data) => {
        try {
            setIsSubmitting(true);
            await onSubmit({
                passwordCurrent: passwordInfo?.hasPassword ? data.currentPassword : undefined,
                password: data.newPassword
            });
            reset();
        } catch (error: unknown) {
            const errorMessage = error instanceof Error
                ? error.message
                : 'Failed to change password';
            setError('confirmPassword', { message: errorMessage });
        } finally {
            setIsSubmitting(false);
        }
    });

    const handleCancel = () => {
        reset();
        onCancel();
    };

    return (
        <Container className='password-form d-flex column gap-3 p-4 b-soft radius-md'>
            {passwordInfo?.hasPassword && (
                <FormFieldRHF
                    name='currentPassword'
                    control={control}
                    label='Current Password'
                    type='password'
                    placeholder='Enter your current password'
                    icon={<Key size={18} />}
                />
            )}

            <FormFieldRHF
                name='newPassword'
                control={control}
                label='New Password'
                type='password'
                placeholder='Enter new password (min. 8 characters)'
                icon={<Lock size={18} />}
            />

            <FormFieldRHF
                name='confirmPassword'
                control={control}
                label='Confirm New Password'
                type='password'
                placeholder='Confirm your new password'
                icon={<Lock size={18} />}
            />

            <Container className='d-flex gap-05'>
                <Button
                    intent='brand'
                    onClick={onFormSubmit}
                    isLoading={isSubmitting}
                    disabled={isSubmitting}
                >
                    {passwordInfo?.hasPassword ? 'Change Password' : 'Set Password'}
                </Button>
                <Button
                    variant='ghost'
                    onClick={handleCancel}
                >
                    Cancel
                </Button>
            </Container>
        </Container>
    );
};

export default PasswordChangeForm;
