import React, { useState } from 'react';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import SettingsSection from '@/modules/auth/presentation/components/atoms/SettingsSection';
import SettingsSectionHeader from '@/modules/auth/presentation/components/molecules/SettingsSectionHeader';
import AvatarUpload from '@/modules/auth/presentation/components/organisms/AvatarUpload';
import ProfileForm from '@/modules/auth/presentation/components/organisms/ProfileForm';
import DangerZone from '@/shared/presentation/components/DangerZone';
import { useAuthStore } from '@/modules/auth/presentation/stores/use-auth-store';
import useAuthUseCases from '@/modules/auth/presentation/hooks/use-auth-use-cases';
import { ProfileForm as ProfileFormType } from '@/modules/auth/presentation/components/organisms/ProfileForm/validation-schema';
import { Trash2 } from 'lucide-react';
import './GeneralSettings.css';

const GeneralSettings: React.FC = () => {
    const user = useAuthStore((state) => state.user);
    const setUser = useAuthStore((state) => state.setUser);
    const { updateMeUseCase } = useAuthUseCases();

    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

    const handleAvatarUpload = async (file: File) => {
        setIsUploadingAvatar(true);

        try{
            const formData = new FormData();
            formData.append('avatar', file);

            const updatedUser = await updateMeUseCase.execute({
                data: formData
            });

            setUser(updatedUser);
        }catch(error){
            console.error('Failed to upload avatar:', error);
            throw error;
        }finally{
            setIsUploadingAvatar(false);
        }
    };

    const handleProfileUpdate = async (data: ProfileFormType) => {
        const updatedUser = await updateMeUseCase.execute({
            data: {
                fullName: data.fullName,
                email: data.email
            }
        });
        setUser(updatedUser);
    };

    const handleDeleteAccount = () => {
        if (window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
            alert('Account deletion is not implemented yet.');
        }
    };

    return (
        <Container className="general-settings-container d-flex column gap-3 p-2">
            <Title className="font-size-5 font-weight-6">
                General Settings
            </Title>

            <SettingsSection>
                <SettingsSectionHeader
                    title="Profile"
                    description="Update your personal information and profile picture" />

                <Container className="d-flex column gap-1">
                    <AvatarUpload
                        avatarUrl={user?.avatar || null}
                        isUploading={isUploadingAvatar}
                        onUpload={handleAvatarUpload} />

                    <ProfileForm
                        initialValues={{
                            fullName: user?.fullName || '',
                            email: user?.email || ''
                        }}
                        onUpdate={handleProfileUpdate} />
                </Container>
            </SettingsSection>

            <DangerZone
                title="Delete Account"
                description="Permanently delete your account and all associated data"
                actionLabel="Delete Account"
                actionIcon={<Trash2 size={16} />}
                onAction={handleDeleteAccount}
            />
        </Container>
    );
};

export default GeneralSettings;
