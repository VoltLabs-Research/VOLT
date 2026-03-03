import React, { useCallback, useMemo, useState } from 'react';
import Container from '@/shared/presentation/components/Container';
import SettingsPage from '../SettingsPage';
import SettingsSection from '@/modules/auth/presentation/components/atoms/SettingsSection';
import SettingsSectionHeader from '@/modules/auth/presentation/components/molecules/SettingsSectionHeader';
import AvatarUpload from '@/modules/auth/presentation/components/organisms/AvatarUpload';
import ProfileForm from '@/modules/auth/presentation/components/organisms/ProfileForm';
import DangerZone from '@/shared/presentation/components/DangerZone';
import { buildFileFormData } from '@/shared/utils/file';
import { useAuthStore } from '@/modules/auth/presentation/stores/use-auth-store';
import { useCurrentUser } from '@/modules/auth/presentation/hooks/use-current-user';
import useAuthUseCases from '@/modules/auth/presentation/hooks/use-auth-use-cases';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { ProfileForm as ProfileFormType } from '@/modules/auth/presentation/components/organisms/ProfileForm/validation-schema';
import { Trash2 } from 'lucide-react';

const GeneralSettings: React.FC = () => {
    const user = useCurrentUser();
    const setUser = useAuthStore((state) => state.setUser);
    const signOut = useAuthStore((state) => state.signOut);
    const { authRepository } = useAuthUseCases();
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

    const handleAvatarUpload = useCallback(async (file: File) => {
        setIsUploadingAvatar(true);

        try{
            const formData = buildFileFormData([{ name: 'avatar', file }]);

            const updatedUser = await showPromise(
                authRepository.updateMe(formData),
                {
                    loading: { title: 'Uploading avatar...' },
                    success: { title: 'Avatar updated' },
                    error: { title: 'Failed to upload avatar' }
                }
            );

            setUser(updatedUser);
        }catch(error){
            console.error('Failed to upload avatar:', error);
            throw error;
        }finally{
            setIsUploadingAvatar(false);
        }
    }, [authRepository, setUser]);

    const handleProfileUpdate = useCallback(async (data: ProfileFormType) => {
        const updatedUser = await showPromise(
            authRepository.updateMe({
                fullName: data.fullName,
                email: data.email
            }),
            {
                loading: { title: 'Updating profile...' },
                success: { title: 'Profile updated' },
                error: { title: 'Failed to update profile' }
            }
        );
        setUser(updatedUser);
    }, [authRepository, setUser]);

    const profileInitialValues = useMemo(() => ({
        fullName: user?.fullName || '',
        email: user?.email || ''
    }), [user?.fullName, user?.email]);

    const handleDeleteAccount = useCallback(async () => {
        if(!window.confirm('Are you sure you want to delete your account? This action cannot be undone.')){
            return;
        }
        await showPromise(
            authRepository.deleteMe(),
            {
                loading: { title: 'Deleting account...' },
                success: { title: 'Account deleted' },
                error: { title: 'Failed to delete account' }
            }
        );
        signOut();
    }, [authRepository, signOut]);

    return (
        <SettingsPage title="General Settings">
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
                        initialValues={profileInitialValues}
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
        </SettingsPage>
    );
};

export default GeneralSettings;
