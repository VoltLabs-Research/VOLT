import React from 'react';
import Container from '@/shared/presentation/components/Container';
import FormField from '@/shared/presentation/components/FormField';
import Button from '@/shared/presentation/components/Button';
import useForm from '@/shared/presentation/hooks/use-form';
import { passwordChangeSchema, PasswordChangeForm as PasswordChangeFormType, PasswordInfo } from './validation-schema';
import { Lock, Key } from 'lucide-react';
import './PasswordChangeForm.css';

interface PasswordChangeFormProps {
    passwordInfo: PasswordInfo | null;
    isOpen: boolean;
    onSubmit: (data: { currentPassword?: string; newPassword: string }) => Promise<void>;
    onCancel: () => void;
};

const PasswordChangeForm: React.FC<PasswordChangeFormProps> = ({
    passwordInfo,
    isOpen,
    onSubmit,
    onCancel
}) => {
    const form = useForm<PasswordChangeFormType>({
        initialValues: {
            currentPassword: '',
            newPassword: '',
            confirmPassword: ''
        },
        schema: passwordChangeSchema,
        validateOnChange: false,
        validateOnBlur: true
    });

    if (!isOpen) return null;

    const handleSubmit = form.handleSubmit(async (data) => {
        const fieldsToValidate: Array<keyof PasswordChangeFormType> = passwordInfo?.hasPassword 
            ? ['currentPassword', 'newPassword', 'confirmPassword']
            : ['newPassword', 'confirmPassword'];

        form.validateForm(fieldsToValidate);

        const hasErrors = fieldsToValidate.some(field => form.errors[field]);
        if (hasErrors) return;

        try {
            await onSubmit({
                currentPassword: passwordInfo?.hasPassword ? data.currentPassword : undefined,
                newPassword: data.newPassword
            });
            form.reset();
        } catch (error: any) {
            form.setErrors({
                confirmPassword: error.message || 'Failed to change password'
            });
        }
    });

    const handleCancel = () => {
        form.reset();
        onCancel();
    };

    return (
        <Container className="password-form d-flex column gap-3 p-4 b-soft b-radius-08">
            {passwordInfo?.hasPassword && (
                <FormField
                    label="Current Password"
                    type="password"
                    placeholder="Enter your current password"
                    icon={<Key size={18} />}
                    {...form.field('currentPassword')}
                />
            )}

            <FormField
                label="New Password"
                type="password"
                placeholder="Enter new password (min. 8 characters)"
                icon={<Lock size={18} />}
                {...form.field('newPassword')}
            />

            <FormField
                label="Confirm New Password"
                type="password"
                placeholder="Confirm your new password"
                icon={<Lock size={18} />}
                {...form.field('confirmPassword')}
            />

            <Container className="d-flex gap-05">
                <Button
                    intent="brand"
                    onClick={handleSubmit}
                    isLoading={form.isSubmitting}
                    disabled={form.isSubmitting}
                >
                    {passwordInfo?.hasPassword ? 'Change Password' : 'Set Password'}
                </Button>
                <Button
                    variant="ghost"
                    onClick={handleCancel}
                >
                    Cancel
                </Button>
            </Container>
        </Container>
    );
};

export default PasswordChangeForm;
