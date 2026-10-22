import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { useDeleteMeMutation, useUpdateMeMutation } from '@/modules/auth/hooks/queries';
import { useAuthStore } from '@/modules/auth/store/use-auth-store';
import { useSingleTenant } from '@/modules/system/hooks/use-single-tenant';
import { runAction } from '@/shared/ui/actions/run-action';
import AvatarUpload from '@/modules/auth/components/AvatarUpload';
import ProfileForm from '@/modules/auth/components/ProfileForm';
import { Theme, useTheme } from '@/shared/ui/hooks/use-theme';
import { Button, ToggleButton, ToggleButtonGroup } from '@heroui/react';
import SettingsPage from '@/shared/ui/components/SettingsPage';
import SettingsSectionHeader from '@/shared/ui/components/SettingsSectionHeader';
import SettingsRow from '@/modules/auth/components/SettingsRow';
import { createPromiseToastOptions } from '@/shared/ui/utils/toast-options';
import { Monitor, Moon, Sun, Trash2 } from 'lucide-react';
import { getInitialsFromUser, resolveAvatarUrl } from '@/shared/utils/user';
import { useMemo, useState } from 'react';
import type { Key } from 'react';
import type { ProfileForm as ProfileFormType } from '@/modules/auth/components/ProfileForm/validation-schema';

const AVATAR_TOAST_OPTIONS = createPromiseToastOptions({
    loading: 'Uploading avatar...',
    success: 'Avatar updated',
    error: 'Failed to upload avatar'
});

const THEME_OPTIONS = [
    { value: Theme.System, label: 'System', icon: Monitor },
    { value: Theme.Light, label: 'Light', icon: Sun },
    { value: Theme.Dark, label: 'Dark', icon: Moon }
] as const;

const DELETE_ACCOUNT_TOAST_OPTIONS = createPromiseToastOptions({
    loading: 'Deleting account...',
    success: 'Account deleted',
    error: 'Failed to delete account'
});

const GeneralSettings = () => {
    const user = useCurrentUser();
    const singleTenant = useSingleTenant();
    const signOut = useAuthStore((state) => state.signOut);
    const updateMe = useUpdateMeMutation();
    const deleteMe = useDeleteMeMutation();
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const { preference, setTheme } = useTheme();

    const handleThemeChange = (keys: Set<Key>) => {
        const [next] = keys;
        if(next !== undefined) setTheme(next as Theme);
    };

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
            {!singleTenant && (
                <div className='flex flex-col gap-3'>
                    <SettingsSectionHeader
                        title="Profile"
                        description="Update your personal information and profile picture" />
                    <AvatarUpload
                        avatarUrl={resolveAvatarUrl(user?.avatar) || null}
                        initials={getInitialsFromUser(user)}
                        isUploading={isUploadingAvatar}
                        onUpload={handleAvatarUpload} />
                    <div className='rounded-2xl bg-foreground/4 p-5'>
                        <ProfileForm
                            initialValues={profileInitialValues}
                            onUpdate={handleProfileUpdate} />
                    </div>
                </div>
            )}
            <div className='flex flex-col gap-3'>
                <SettingsSectionHeader title="Appearance" />
                <SettingsRow
                    title='Theme'
                    description='Choose your preferred theme for the interface'
                    rightContent={(
                        <ToggleButtonGroup
                            selectionMode='single'
                            disallowEmptySelection
                            selectedKeys={[preference]}
                            onSelectionChange={handleThemeChange}
                            aria-label='Theme'
                        >
                            {THEME_OPTIONS.map((option) => (
                                <ToggleButton
                                    key={option.value}
                                    id={option.value}
                                    variant='ghost'
                                >
                                    <option.icon size={14} aria-hidden='true' />
                                    {option.label}
                                </ToggleButton>
                            ))}
                        </ToggleButtonGroup>
                    )} />
            </div>
            {!singleTenant && (
                <SettingsRow
                    isDanger
                    title='Delete Account'
                    description='Permanently delete your account and all associated data'
                    rightContent={(
                        <Button
                            variant='danger-soft'
                            size='sm'
                            onPress={handleDeleteAccount}
                        >
                            <Trash2 size={16} aria-hidden='true' />
                            Delete Account
                        </Button>
                    )} />
            )}
        </SettingsPage>
    );
};

export default GeneralSettings;
