import React from 'react';
import FormInput from '@/components/atoms/form/FormInput';
import { TbShield, TbX, TbKey, TbEdit, TbActivity, TbDots } from 'react-icons/tb';
import Section from '@/components/atoms/settings/Section';
import SectionHeader from '@/components/atoms/settings/SectionHeader';
import StatusBadge from '@/components/atoms/common/StatusBadge';
import { useFormValidation } from '@/hooks/useFormValidation';

interface PasswordInfo { lastChanged?: string }

interface AuthenticationSettingsProps {
    isLoadingPasswordInfo: boolean;
    passwordInfo: PasswordInfo | null;
    showPasswordForm: boolean;
    setShowPasswordForm: (v: boolean) => void;
    passwordForm: { currentPassword: string; newPassword: string; confirmPassword: string };
    setPasswordForm: React.Dispatch<React.SetStateAction<{ currentPassword: string; newPassword: string; confirmPassword: string }>>;
    isChangingPassword: boolean;
    onSubmitPassword: (e: React.FormEvent) => void;
    loginActivities: any[];
    loginActivityLoading: boolean;
    onOpenLoginActivity: () => void;
}

const AuthenticationSettings: React.FC<AuthenticationSettingsProps> = ({
    isLoadingPasswordInfo,
    passwordInfo,
    showPasswordForm,
    setShowPasswordForm,
    passwordForm,
    setPasswordForm,
    isChangingPassword,
    onSubmitPassword,
    onOpenLoginActivity
}) => {
    const { errors, validate, checkField } = useFormValidation({
        currentPassword: { required: true, message: 'Current password is required' },
        newPassword: {
            required: true,
            minLength: 8,
            maxLength: 16,
            message: 'Password must be between 8 and 16 characters'
        },
        confirmPassword: {
            required: true,
            validate: (value, formData) => value === formData?.newPassword || 'Passwords do not match'
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if(validate(passwordForm)) {
            onSubmitPassword(e);
        }
    };

    const handlePasswordChange = (field: keyof typeof passwordForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setPasswordForm(prev => ({ ...prev, [field]: value }));

        // For confirmPassword, we need the newPassword value
        const formData = field === 'confirmPassword' ? { newPassword: passwordForm.newPassword } : undefined;
        checkField(field, value, formData);
    };

    return(
        <div className='settings-content'>
            <Section>
                <SectionHeader title='Security Settings' description='Manage your account security and authentication methods' />

                <div className='security-grid'>
                    <div className='security-item'>
                        <div className='security-header'>
                            <div className='security-icon'>
                                <TbShield size={24} />
                            </div>
                            <div className='security-info'>
                                <h4>Two-Factor Authentication</h4>
                                <p>Add an extra layer of security to your account</p>
                            </div>
                            <div className='security-status'>
                                <StatusBadge variant='inactive'>
                                    <TbX size={14} />
                                    Disabled
                                </StatusBadge>
                            </div>
                        </div>
                    </div>

                    <div className='security-item'>
                        <div className='security-header'>
                            <div className='security-icon'>
                                <TbKey size={24} />
                            </div>
                            <div className='security-info'>
                                <h4>Password</h4>
                                <p>{isLoadingPasswordInfo ? 'Loading...' : (passwordInfo?.lastChanged ? `Last changed ${passwordInfo.lastChanged}` : 'Password information unavailable')}</p>
                            </div>
                            <div className='security-actions'>
                                <button className='action-button' onClick={() => setShowPasswordForm(!showPasswordForm)}>
                                    <TbEdit size={16} />
                                    {showPasswordForm ? 'Cancel' : 'Change'}
                                </button>
                            </div>
                        </div>

                        {showPasswordForm && (
                            <div className='password-form'>
                                <form onSubmit={handleSubmit}>
                                    <div className='form-group'>
                                        <FormInput
                                            type='password'
                                            label='Current Password'
                                            value={passwordForm.currentPassword}
                                            onChange={handlePasswordChange('currentPassword')}
                                            required
                                            error={errors.currentPassword}
                                        />
                                    </div>
                                    <div className='form-group'>
                                        <FormInput
                                            type='password'
                                            label='New Password'
                                            value={passwordForm.newPassword}
                                            onChange={handlePasswordChange('newPassword')}
                                            required
                                            error={errors.newPassword}
                                        />
                                    </div>
                                    <div className='form-group'>
                                        <FormInput
                                            type='password'
                                            label='Confirm New Password'
                                            value={passwordForm.confirmPassword}
                                            onChange={handlePasswordChange('confirmPassword')}
                                            required
                                            error={errors.confirmPassword}
                                        />
                                    </div>
                                    <div className='form-actions'>
                                        <button type='button' className='action-button secondary' onClick={() => setShowPasswordForm(false)}>Cancel</button>
                                        <button type='submit' className='action-button primary' disabled={isChangingPassword}>{isChangingPassword ? 'Changing...' : 'Change Password'}</button>
                                    </div>
                                </form>
                            </div>
                        )}
                    </div>

                    <div className='security-item'>
                        <div className='security-header'>
                            <div className='security-icon'>
                                <TbActivity size={24} />
                            </div>
                            <div className='security-info'>
                                <h4>Login Activity</h4>
                                <p>Monitor your account access and sessions</p>
                            </div>
                            <div className='security-actions'>
                                <button className='action-button' onClick={onOpenLoginActivity}>
                                    <TbDots size={16} />
                                    View
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </Section>
        </div>
    );
};

export default AuthenticationSettings;
