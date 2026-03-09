import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { useDeleteMeMutation, useUpdateMeMutation } from '@/modules/auth/hooks/queries';
import { useAuthStore } from '@/modules/auth/stores/use-auth-store';
import useConfirm from '@/shared/presentation/hooks/use-confirm';
import { showPromise } from '@/shared/presentation/hooks/toast';
import AvatarUpload from '@/modules/auth/components/organisms/AvatarUpload';
import ProfileForm from '@/modules/auth/components/organisms/ProfileForm';
import Container from '@/shared/presentation/components/Container';
import DangerZone from '@/shared/presentation/components/DangerZone';
import SettingsPage from '@/shared/presentation/components/SettingsPage';
import SettingsSection from '@/shared/presentation/components/SettingsSection';
import SettingsSectionHeader from '@/shared/presentation/components/SettingsSectionHeader';
import { Trash2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import type { ProfileForm as ProfileFormType } from '@/modules/auth/components/organisms/ProfileForm/validation-schema';

const GeneralSettings = () => {
    const user = useCurrentUser();
    const signOut = useAuthStore((state) => state.signOut);
    const updateMe = useUpdateMeMutation();
    const deleteMe = useDeleteMeMutation();
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const { confirm } = useConfirm();

    const handleAvatarUpload = useCallback(async (file: File) => {
        setIsUploadingAvatar(true);

        try{
            await showPromise(
                updateMe.mutateAsync({ avatar: file }),
                {
                    loading: { title: 'Uploading avatar...' },
                    success: { title: 'Avatar updated' },
                    error: { title: 'Failed to upload avatar' }
                }
            );
        }finally{
            setIsUploadingAvatar(false);
        }
    }, [updateMe]);

    const handleProfileUpdate = useCallback(async (data: ProfileFormType) => {
        await showPromise(
            updateMe.mutateAsync({
                fullName: data.fullName,
                email: data.email
            }),
            {
                loading: { title: 'Updating profile...' },
                success: { title: 'Profile updated' },
                error: { title: 'Failed to update profile' }
            }
        );
    }, [updateMe]);

    const profileInitialValues = useMemo(() => ({
        fullName: user?.fullName || '',
        email: user?.email || ''
    }), [user?.fullName, user?.email]);

    const handleDeleteAccount = useCallback(async () => {
        const isConfirmed = await confirm({
            title: 'Delete your account?',
            description: 'This action cannot be undone.',
            confirmText: 'Delete'
        });

        if(!isConfirmed){
            return;
        }
        await showPromise(
            deleteMe.mutateAsync(),
            {
                loading: { title: 'Deleting account...' },
                success: { title: 'Account deleted' },
                error: { title: 'Failed to delete account' }
            }
        );
        signOut();
    }, [confirm, deleteMe, signOut]);

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
