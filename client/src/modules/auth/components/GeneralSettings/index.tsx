import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { useDeleteMeMutation, useUpdateMeMutation } from '@/modules/auth/hooks/queries';
import { useAuthStore } from '@/modules/auth/store/use-auth-store';
import { runAction } from '@/shared/ui/actions/run-action';
import AvatarUpload from '@/modules/auth/components/AvatarUpload';
import ProfileForm from '@/modules/auth/components/ProfileForm';
import { Alert, Button } from '@heroui/react';
import SettingsPage from '@/shared/ui/components/SettingsPage';
import SettingsSectionHeader from '@/shared/ui/components/SettingsSectionHeader';
import { createPromiseToastOptions } from '@/shared/ui/utils/toast-options';
import { Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
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

    const handleAvatarUpload = async (file: File) => {
        setIsUploadingAvatar(true);

        try{
            await runAction({
                action: () => updateMe.mutateAsync({ avatar: file }),
                toast: AVATAR_TOAST_OPTIONS
            });
        }finally{
            setIsUploadingAvatar(false);
        }
    };

    const handleProfileUpdate = async (data: ProfileFormType) => {
        await updateMe.mutateAsync({
            fullName: data.fullName,
            email: data.email
        });
    };

    const profileInitialValues = useMemo(() => ({
        fullName: user?.fullName || '',
        email: user?.email || ''
    }), [user?.fullName, user?.email]);

    const handleDeleteAccount = async () => {
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
    };

    return (
        <SettingsPage title="General Settings">
            <div className='flex flex-col gap-4 p-6 rounded-xl border border-border'>
                <SettingsSectionHeader
                    title="Profile"
                    description="Update your personal information and profile picture" />
                <div className='flex flex-col gap-4'>
                    <AvatarUpload
                        avatarUrl={user?.avatar || null}
                        isUploading={isUploadingAvatar}
                        onUpload={handleAvatarUpload} />
                    <ProfileForm
                        initialValues={profileInitialValues}
                        onUpdate={handleProfileUpdate} />
                </div>
            </div>
            <Alert status='danger' role='region' aria-label='Delete Account'>
                <Alert.Content>
                    <Alert.Title>Delete Account</Alert.Title>
                    <Alert.Description>
                        Permanently delete your account and all associated data
                    </Alert.Description>
                </Alert.Content>
                <Button
                    variant='ghost'
                    size='sm'
                    className='text-danger'
                    onPress={handleDeleteAccount}
                >
                    <Trash2 size={16} />
                    Delete Account
                </Button>
            </Alert>
        </SettingsPage>
    );
};

export default GeneralSettings;
