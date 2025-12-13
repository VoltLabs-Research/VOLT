import React, { useState, useEffect } from 'react';
import FormInput from '@/components/atoms/form/FormInput';
import RecentActivity from '@/components/molecules/auth/RecentActivity';
import { TbCheck, TbTrash, TbX, TbActivity, TbCamera } from 'react-icons/tb';
import authApi from '@/services/api/auth';
import Section from '@/components/atoms/settings/Section';
import SectionHeader from '@/components/atoms/settings/SectionHeader';
import StatusBadge from '@/components/atoms/common/StatusBadge';
import { useFormValidation } from '@/hooks/useFormValidation';
import './GeneralSettings.css';

interface GeneralSettingsProps {
    user: { firstName?: string; lastName?: string; email?: string; avatar?: string } | null;
    userData: { firstName: string; lastName: string; email: string };
    isUpdating: boolean;
    updateError: string | null;
    onFieldChange: (field: string, value: string) => void;
    onDeleteAccount: () => void;
}

const GeneralSettings: React.FC<GeneralSettingsProps> = ({ user, userData, isUpdating, updateError, onFieldChange, onDeleteAccount }) => {
    const [formData, setFormData] = useState({
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email
    });
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

    const { errors, validate, checkField } = useFormValidation({
        firstName: { required: true, minLength: 4, maxLength: 16, message: 'First name must be between 4 and 16 characters' },
        lastName: { required: true, minLength: 4, maxLength: 16, message: 'Last name must be between 4 and 16 characters' },
        email: { required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email address' }
    });

    useEffect(() => {
        if (user) {
            setFormData({
                firstName: user.firstName || '',
                lastName: user.lastName || '',
                email: user.email || ''
            });
        }
    }, [user]);

    const handleInputChange = (field: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setFormData(prev => ({ ...prev, [field]: value }));

        // Validate the field
        const errorMessage = checkField(field, value);

        // Only propagate to parent (and trigger server update) if there's no validation error
        if (!errorMessage) {
            onFieldChange(field, value);
        }
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type and size
        if (!file.type.startsWith('image/')) {
            alert('Please upload an image file');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            alert('File size must be less than 5MB');
            return;
        }

        const formData = new FormData();
        formData.append('avatar', file);

        try {
            setIsUploadingAvatar(true);
            await authApi.updateMe(formData); // Refactored to use authApi.updateMe
            // Refresh page to show new avatar (or update context if available)
            window.location.reload();
        } catch (error) {
            console.error('Failed to upload avatar:', error);
            alert('Failed to upload avatar. Please try again.');
        } finally {
            setIsUploadingAvatar(false);
        }
    };

    return (
        <div className='settings-content'>
            <Section className='profile-section'>
                <div className='profile-header'>
                    <div className='profile-avatar'>
                        <div className='profile-avatar-container' onClick={() => document.getElementById('avatar-upload')?.click()}>
                            {user?.avatar ? (
                                <img src={user.avatar} alt="Profile" className="profile-avatar-img" />
                            ) : (
                                <div className='avatar-circle'>
                                    {user?.firstName?.[0]}{user?.lastName?.[0]}
                                </div>
                            )}
                            <div className='profile-avatar-overlay'>
                                {isUploadingAvatar ? (
                                    <TbActivity className="animate-spin" size={24} />
                                ) : (
                                    <TbCamera size={24} />
                                )}
                            </div>
                        </div>
                        <input
                            type="file"
                            id="avatar-upload"
                            className="avatar-upload-input"
                            accept="image/*"
                            onChange={handleAvatarUpload}
                            disabled={isUploadingAvatar}
                        />
                    </div>
                    <div className='profile-info'>
                        <h2 className='profile-name'>{user?.firstName} {user?.lastName}</h2>
                        <p className='profile-email'>{user?.email}</p>
                        <div className='profile-status'>
                            <StatusBadge variant='active'>
                                <TbCheck size={14} />
                                Active Account
                            </StatusBadge>
                        </div>
                    </div>
                </div>
            </Section>

            <Section>
                <SectionHeader title='Personal Information' description='Update your personal details and contact information' />

                <div className='settings-form'>
                    {updateError && (
                        <div className='update-error'>
                            <TbX size={16} />
                            {updateError}
                        </div>
                    )}

                    <div className='form-row'>
                        <div className='form-field-container'>
                            <FormInput
                                value={userData.firstName}
                                label='First name'
                                onChange={handleInputChange('firstName')}
                                disabled={isUpdating}
                                error={errors.firstName}
                            />
                            {isUpdating && (
                                <div className='update-indicator'>
                                    <TbActivity size={16} />
                                    Updating...
                                </div>
                            )}
                        </div>
                        <div className='form-field-container'>
                            <FormInput
                                value={userData.lastName}
                                label='Last name'
                                onChange={handleInputChange('lastName')}
                                disabled={isUpdating}
                                error={errors.lastName}
                            />
                            {isUpdating && (
                                <div className='update-indicator'>
                                    <TbActivity size={16} />
                                    Updating...
                                </div>
                            )}
                        </div>
                    </div>
                    <div className='form-field-container'>
                        <FormInput
                            value={userData.email}
                            label='Email address'
                            onChange={handleInputChange('email')}
                            disabled={isUpdating}
                            error={errors.email}
                        />
                        {isUpdating && (
                            <div className='update-indicator'>
                                <TbActivity size={16} />
                                Updating...
                            </div>
                        )}
                    </div>
                </div>
            </Section>

            <Section>
                <SectionHeader title='Account Activity' description='Recent activity and account statistics' />
                <RecentActivity limit={15} showStats={true} className="account-activity-section" />
            </Section>

            <Section className='danger-section'>
                <SectionHeader title='Danger Zone' description='Irreversible and destructive actions' />
                <div className='danger-actions'>
                    <div className='danger-item'>
                        <div className='danger-info'>
                            <h4>Delete Account</h4>
                            <p>Permanently delete your account and all associated data. This action cannot be undone.</p>
                        </div>
                        <button className='action-button danger' onClick={onDeleteAccount}>
                            <TbTrash size={16} />
                            Delete Account
                        </button>
                    </div>
                </div>
            </Section>
        </div>
    );
};

export default GeneralSettings;


