import { passwordInfoQuery, useChangePasswordMutation } from '@/modules/auth/hooks/queries';
import { showPromise } from '@/shared/ui/hooks/toast';
import SettingsRow from '@/modules/auth/components/SettingsRow';
import { Button } from '@heroui/react';
import { format } from 'date-fns';
import { Activity, ChevronDown, ChevronUp, Lock } from 'lucide-react';
import PasswordChangeForm from '@/modules/auth/components/PasswordChangeForm';
import SettingsPage from '@/shared/ui/components/SettingsPage';
import SettingsSectionHeader from '@/shared/ui/components/SettingsSectionHeader';
import { useState } from 'react';
import type { UpdatePasswordInput } from '@volt/contracts/modules/auth/http';
import { useNavigate } from 'react-router-dom';

const AuthenticationSettings = () => {
    const navigate = useNavigate();
    const [isPasswordFormOpen, setIsPasswordFormOpen] = useState(false);

    const { data: passwordInfo } = passwordInfoQuery(undefined);
    const changePasswordMutation = useChangePasswordMutation();

    const handleChangePassword = async (data: UpdatePasswordInput) => {
        await showPromise(
            async () => {
                await changePasswordMutation.mutateAsync(data);
                setIsPasswordFormOpen(false);
            },
            {
                loading: { title: 'Changing password...' },
                success: { title: 'Password changed successfully' },
                error: { title: 'Failed to change password' }
            }
        );
    };

    let passwordDescription = 'No password set (OAuth only)';

    if (passwordInfo?.hasPassword) {
        passwordDescription = passwordInfo.lastChanged
            ? `Last changed: ${format(new Date(passwordInfo.lastChanged), 'MMMM d, yyyy')}`
            : 'Password configured';
    }

    return (
        <SettingsPage title="Authentication Settings">
            <div className='flex flex-col gap-4'>
                <SettingsSectionHeader
                    title="Password"
                    description="Manage your password and security settings" />

                <div className='flex flex-col gap-4'>
                    <SettingsRow
                        icon={<Lock size={20} />}
                        title="Password"
                        description={passwordDescription}
                        rightContent={(
                            <Button
                                variant="secondary"
                                onPress={() => setIsPasswordFormOpen(!isPasswordFormOpen)}
                            >
                                {passwordInfo?.hasPassword ? 'Change' : 'Set Password'}
                                {isPasswordFormOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </Button>
                        )} />

                    <PasswordChangeForm
                        passwordInfo={passwordInfo ?? null}
                        isOpen={isPasswordFormOpen}
                        onSubmit={handleChangePassword}
                        onCancel={() => setIsPasswordFormOpen(false)} />
                </div>
            </div>

            <div className='flex flex-col gap-4'>
                <SettingsSectionHeader
                    title="Login Activity"
                    description="Monitor recent login sessions and devices" />

                <SettingsRow
                    icon={<Activity size={20} />}
                    title="Recent Sessions"
                    description="View your login history and active sessions"
                    rightContent={<Button variant="secondary" onPress={() => navigate('/dashboard/settings/sessions')}>View Activity</Button>}
                />
            </div>
        </SettingsPage>
    );
};

export default AuthenticationSettings;
