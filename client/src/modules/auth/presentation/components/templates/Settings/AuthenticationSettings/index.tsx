import React, { useState, useEffect, useCallback } from 'react';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import SettingsSection from '@/modules/auth/presentation/components/atoms/SettingsSection';
import SettingsSectionHeader from '@/modules/auth/presentation/components/molecules/SettingsSectionHeader';
import PasswordStatusRow from '@/modules/auth/presentation/components/molecules/PasswordStatusRow';
import LoginActivityRow from '@/modules/auth/presentation/components/molecules/LoginActivityRow';
import PasswordChangeForm from '@/modules/auth/presentation/components/organisms/PasswordChangeForm';
import useAuthUseCases from '@/modules/auth/presentation/hooks/use-auth-use-cases';
import { ChangePasswordInputDTO } from '@/modules/auth/application/dtos';
import { PasswordInfo } from '@/modules/auth/presentation/components/organisms/PasswordChangeForm/validation-schema';

const AuthenticationSettings: React.FC = () => {
    const { authRepository } = useAuthUseCases();

    const [passwordInfo, setPasswordInfo] = useState<PasswordInfo | null>(null);
    const [isPasswordFormOpen, setIsPasswordFormOpen] = useState(false);

    const loadPasswordInfo = useCallback(async () => {
        try{
            const info = await authRepository.getPasswordInfo();
            setPasswordInfo(info);
        }catch(error){
            console.error('Failed to load password info:', error);
        }
    }, [authRepository]);

    useEffect(() => {
        loadPasswordInfo();
    }, [loadPasswordInfo]);

    const handleChangePassword = async (data: ChangePasswordInputDTO) => {
        await authRepository.changePassword(data);

        setIsPasswordFormOpen(false);

        const info = await authRepository.getPasswordInfo();
        setPasswordInfo(info);
    };

    const handleViewLoginActivity = () => {
        alert('Login activity modal not implemented yet');
    };

    return (
        <Container className="settings-page-container d-flex column gap-3 p-2">
            <Title className="font-size-5 font-weight-6">
                Authentication Settings
            </Title>

            <SettingsSection>
                <SettingsSectionHeader
                    title="Password"
                    description="Manage your password and security settings" />

                <Container className="d-flex column gap-1">
                    <PasswordStatusRow
                        passwordInfo={passwordInfo}
                        isFormOpen={isPasswordFormOpen}
                        onToggleForm={() => setIsPasswordFormOpen(!isPasswordFormOpen)} />

                    <PasswordChangeForm
                        passwordInfo={passwordInfo}
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
        </Container>
    );
};

export default AuthenticationSettings;
