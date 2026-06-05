import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { useDeleteMeMutation, useUpdateMeMutation } from '@/modules/auth/hooks/queries';
import { useAuthStore } from '@/modules/auth/stores/use-auth-store';
import { runAction } from '@/shared/presentation/actions/run-action';
import AvatarUpload from '@/modules/auth/components/AvatarUpload';
import ProfileForm from '@/modules/auth/components/ProfileForm';
import Callout from '@/shared/presentation/primitives/Callout';
import SettingsPage from '@/shared/presentation/components/SettingsPage';
import SettingsSectionHeader from '@/shared/presentation/components/SettingsSectionHeader';
import Stack from '@/shared/presentation/primitives/Stack';
import { createPromiseToastOptions } from '@/shared/presentation/utilities/toast-options';
import { Trash2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import type { ProfileForm as ProfileFormType } from '@/modules/auth/components/ProfileForm/validation-schema';

const AVATAR_TOAST_OPTIONS = createPromiseToastOptions({
    loading: 'Uploading avatar...',
    success: 'Avatar updated',
    error: 'Failed to upload avatar'
});

const DELETE_ACCOUNT_TOAST_OPTIONS = createPromiseToastOptions({
    loading: 'Deleting account...',
    success: 'Account deleted',
    error: 'Failed to delete account'
});

const GeneralSettings = () => {
    const user = useCurrentUser();
    const signOut = useAuthStore((state) => state.signOut);
    const updateMe = useUpdateMeMutation();
    const deleteMe = useDeleteMeMutation();
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

    const handleAvatarUpload = useCallback(async (file: File) => {
        setIsUploadingAvatar(true);

        try{
            await runAction({
                action: () => updateMe.mutateAsync({ avatar: file }),
                toast: AVATAR_TOAST_OPTIONS
            });
        }finally{
            setIsUploadingAvatar(false);
        }
    }, [updateMe]);

    const handleProfileUpdate = useCallback(async (data: ProfileFormType) => {
        await updateMe.mutateAsync({
            fullName: data.fullName,
            email: data.email
        });
    }, [updateMe]);

    const profileInitialValues = useMemo(() => ({
        fullName: user?.fullName || '',
        email: user?.email || ''
    }), [user?.fullName, user?.email]);

    const handleDeleteAccount = useCallback(async () => {
        await runAction({
            action: () => deleteMe.mutateAsync(),
            confirm: {
                title: 'Delete your account?',
                description: 'This action cannot be undone.',
                confirmText: 'Delete'
            },
            toast: DELETE_ACCOUNT_TOAST_OPTIONS,
            afterSuccess: () => {
                signOut();
            }
        });
    }, [deleteMe, signOut]);

    return (
        <SettingsPage title="General Settings">
            <Stack border='soft' gap='1' p='1-5' radius='md'>
                <SettingsSectionHeader
                    title="Profile"
                    description="Update your personal information and profile picture" />

                <Stack gap='1'>
                    <AvatarUpload
                        avatarUrl={user?.avatar || null}
                        isUploading={isUploadingAvatar}
                        onUpload={handleAvatarUpload} />

                    <ProfileForm
                        initialValues={profileInitialValues}
                        onUpdate={handleProfileUpdate} />
                </Stack>
            </Stack>

            <Callout
                tone='danger'
                title='Delete Account'
                description='Permanently delete your account and all associated data'
                action={{
                    label: 'Delete Account',
                    icon: <Trash2 size={16} />,
                    onClick: handleDeleteAccount
                }}
            />
        </SettingsPage>
    );
};

export default GeneralSettings;
