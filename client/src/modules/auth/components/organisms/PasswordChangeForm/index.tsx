import './PasswordChangeForm.css';
import { passwordChangeSchema } from './validation-schema';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import useZodForm from '@/shared/presentation/hooks/use-zod-form';
import { Lock, Key } from 'lucide-react';
import { useState } from 'react';
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
            let errorMessage = 'Failed to change password';

            if (error instanceof Error) {
                errorMessage = error.message;
            }

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
