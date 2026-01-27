import React, { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/modules/auth/presentation/stores';
import AuthenticationSettings from '@/modules/settings/presentation/components/molecules/AuthenticationSettings';
import LoginActivityModal from '@/modules/auth/presentation/components/molecules/LoginActivityModal';
import useLoginActivity from '@/modules/auth/presentation/hooks/use-login-activity';

const AuthenticationPage: React.FC = () => {
    const {
        passwordInfo,
        isChangingPassword,
        isLoadingPasswordInfo,
        changePassword,
        getPasswordInfo
    } = useAuthStore();

    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [passwordForm, setPasswordForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    const { activities: loginActivities, loading: loginActivityLoading } = useLoginActivity(10);

    useEffect(() => {
        getPasswordInfo();
    }, [getPasswordInfo]);

    const handlePasswordChange = useCallback(async(e: React.FormEvent) => {
        e.preventDefault();
        try{
            await changePassword(passwordForm);
            setShowPasswordForm(false);
            setPasswordForm({
                currentPassword: '',
                newPassword: '',
                confirmPassword: ''
            });
            await getPasswordInfo();
        }catch(error: any){
            console.error('Password change failed:', error);
        }
    }, [changePassword, passwordForm, getPasswordInfo]);

    const openLoginActivityModal = useCallback(() => {
        (document.getElementById('login-activity-modal') as HTMLDialogElement)?.showModal();
    }, []);

    return (
        <>
            <AuthenticationSettings
                isLoadingPasswordInfo={isLoadingPasswordInfo}
                passwordInfo={passwordInfo ?? null}
                showPasswordForm={showPasswordForm}
                setShowPasswordForm={setShowPasswordForm}
                passwordForm={passwordForm}
                setPasswordForm={setPasswordForm}
                isChangingPassword={isChangingPassword}
                onSubmitPassword={handlePasswordChange}
                loginActivities={loginActivities}
                loginActivityLoading={loginActivityLoading}
                onOpenLoginActivity={openLoginActivityModal}
            />
            <LoginActivityModal />
        </>
    );
};

export default AuthenticationPage;
