import { passwordInfoQuery, useChangePasswordMutation } from '@/modules/auth/hooks/queries';
import { showPromise } from '@/shared/presentation/hooks/toast';
import SettingsSection from '@/modules/auth/components/atoms/SettingsSection';
import LoginActivityRow from '@/modules/auth/components/molecules/LoginActivityRow';
import PasswordStatusRow from '@/modules/auth/components/molecules/PasswordStatusRow';
import PasswordChangeForm from '@/modules/auth/components/organisms/PasswordChangeForm';
import SettingsSectionHeader from '@/modules/auth/components/molecules/SettingsSectionHeader';
import Container from '@/shared/presentation/components/Container';
import SettingsPage from '@/shared/presentation/components/SettingsPage';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ChangePasswordInputDTO } from '@/modules/auth/api/dtos/change-password';

const AuthenticationSettings = () => {
    const navigate = useNavigate();
    const [isPasswordFormOpen, setIsPasswordFormOpen] = useState(false);

    const { data: passwordInfo } = passwordInfoQuery(undefined);
    const changePasswordMutation = useChangePasswordMutation();

    const handleChangePassword = async (data: ChangePasswordInputDTO) => {
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

    const handleViewLoginActivity = () => {
        navigate('/dashboard/settings/sessions');
    };

    return (
        <SettingsPage title="Authentication Settings">
            <SettingsSection>
                <SettingsSectionHeader
                    title="Password"
                    description="Manage your password and security settings" />

                <Container className="d-flex column gap-1">
                    <PasswordStatusRow
                        passwordInfo={passwordInfo ?? null}
                        isFormOpen={isPasswordFormOpen}
                        onToggleForm={() => setIsPasswordFormOpen(!isPasswordFormOpen)} />

                    <PasswordChangeForm
                        passwordInfo={passwordInfo ?? null}
                        isOpen={isPasswordFormOpen}
                        onSubmit={handleChangePassword}
                        onCancel={() => setIsPasswordFormOpen(false)} />
                </Container>
            </SettingsSection>

            <SettingsSection>
                <SettingsSectionHeader
                    title="Login Activity"
                    description="Monitor recent login sessions and devices" />

                <LoginActivityRow onViewActivity={handleViewLoginActivity} />
            </SettingsSection>
        </SettingsPage>
    );
};

export default AuthenticationSettings;
