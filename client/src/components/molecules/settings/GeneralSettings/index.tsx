import React from 'react';
import FormInput from '@/components/atoms/form/FormInput';
import RecentActivity from '@/components/molecules/RecentActivity';
import { TbCheck, TbTrash, TbX, TbActivity } from 'react-icons/tb';
import Section from '@/components/atoms/settings/Section';
import SectionHeader from '@/components/atoms/settings/SectionHeader';
import StatusBadge from '@/components/atoms/StatusBadge';

interface GeneralSettingsProps {
    user: { firstName?: string; lastName?: string; email?: string } | null;
    userData: { firstName: string; lastName: string; email: string };
    isUpdating: boolean;
    updateError: string | null;
    onFieldChange: (field: string, value: string) => void;
    onDeleteAccount: () => void;
}

const GeneralSettings: React.FC<GeneralSettingsProps> = ({ user, userData, isUpdating, updateError, onFieldChange, onDeleteAccount }) => {
    return (
        <div className='settings-content'>
            <Section className='profile-section'>
                <div className='profile-header'>
                    <div className='profile-avatar'>
                        <div className='avatar-circle'>
                            {user?.firstName?.[0]}{user?.lastName?.[0]}
                        </div>
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
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onFieldChange('firstName', e.target.value)}
                                disabled={isUpdating}
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
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onFieldChange('lastName', e.target.value)}
                                disabled={isUpdating}
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
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onFieldChange('email', e.target.value)}
                            disabled={isUpdating}
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


