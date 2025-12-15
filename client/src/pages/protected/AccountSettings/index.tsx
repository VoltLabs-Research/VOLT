import React, { useState, useEffect } from 'react';
import { TbUser, TbShield, TbPalette, TbBell, TbDeviceDesktop, TbDownload, TbSettings, TbPlug } from 'react-icons/tb';
import useAuthStore from '@/stores/authentication';
import authApi from '@/services/api/auth';
import LoginActivityModal from '@/components/molecules/auth/LoginActivityModal';
import SettingsSidebar from '@/components/molecules/settings/SettingsSidebar';
import GeneralSettings from '@/components/molecules/settings/GeneralSettings';
import AuthenticationSettings from '@/components/molecules/settings/AuthenticationSettings';
import SessionsSettings from '@/components/molecules/settings/SessionsSettings';
import ThemeSettings from '@/components/molecules/settings/ThemeSettings';
import NotificationsSettings from '@/components/molecules/settings/NotificationsSettings';
import DataExportSettings from '@/components/molecules/settings/DataExportSettings';
import AdvancedSettings from '@/components/molecules/settings/AdvancedSettings';
import IntegrationsSettings from '@/components/molecules/settings/IntegrationsSettings';
import useSessions from '@/hooks/auth/use-sessions';
import useLoginActivity from '@/hooks/auth/use-login-activity';
import './AccountSettings.css';
import Container from '@/components/primitives/Container';
import Title from '@/components/primitives/Title';
import Paragraph from '@/components/primitives/Paragraph';

const AccountSettings: React.FC = () => {
    const {
        user,
        passwordInfo,
        isChangingPassword,
        isLoadingPasswordInfo,
        changePassword,
        getPasswordInfo
    } = useAuthStore();

 
    const [activeSection, setActiveSection] = useState('General');
    const [userData, setUserData] = useState({
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        email: user?.email || ''
    });
    const [currentTheme, setCurrentTheme] = useState('dark');
    const [isUpdating, setIsUpdating] = useState(false);
    const [updateError, setUpdateError] = useState<string | null>(null);
    const [showLoginActivityModal, setShowLoginActivityModal] = useState(false);
    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [passwordForm, setPasswordForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const { sessions, loading: sessionsLoading, revokeSession, revokeAllOtherSessions } = useSessions();
    const { activities: loginActivities, loading: loginActivityLoading } = useLoginActivity(10);

    // Initialize user data when user changes
    useEffect(() => {
        if (user) {
            setUserData({
                firstName: user.firstName || '',
                lastName: user.lastName || '',
                email: user.email || ''
            });
        }
    }, [user]);

    // Load password info when component mounts
    useEffect(() => {
        getPasswordInfo();
    }, [getPasswordInfo]);

    // Initialize theme from localStorage or system preference
    useEffect(() => {
        const savedTheme = localStorage.getItem('theme');
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        const theme = savedTheme || systemTheme;
        setCurrentTheme(theme);
        document.documentElement.setAttribute('data-theme', theme);
    }, []);

    // Update user data on server
    const updateUserOnServer = async (field: string, value: string) => {
        try {
            setIsUpdating(true);
            setUpdateError(null);

            await authApi.updateMe({ [field]: value } as any);

            // Update local state with server response
            setUserData(prev => ({ ...prev, [field]: value }));
            console.log(`Successfully updated ${field} on server: `, value);
        } catch (error: any) {
            console.error('Error updating user data:', error);
            setUpdateError(`Failed to update ${field}. Please try again.`);

            // Revert local state on error
            if (user) {
                setUserData({
                    firstName: user.firstName || '',
                    lastName: user.lastName || '',
                    email: user.email || ''
                });
            }
        } finally {
            setIsUpdating(false);
        }
    };

    // Handle user data changes with debouncing
    const handleUserDataChange = (field: string, value: string) => {
        setUserData(prev => ({ ...prev, [field]: value }));
        setUpdateError(null);

        // Debounce the server update
        const timeoutId = setTimeout(() => {
            updateUserOnServer(field, value);
        }, 1000);

        // Clear previous timeout
        return () => clearTimeout(timeoutId);
    };

    // Handle theme toggle
    const handleThemeToggle = (theme: string) => {
        setCurrentTheme(theme);
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    };

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await changePassword(passwordForm);
            setShowPasswordForm(false);
            setPasswordForm({
                currentPassword: '',
                newPassword: '',
                confirmPassword: ''
            });
            // Refresh password info after successful change
            await getPasswordInfo();
        } catch (error: any) {
            const errorContext = {
                endpoint: '/auth/change-password',
                method: 'POST',
                statusCode: error?.response?.status,
                errorMessage: error?.message,
                serverMessage: error?.response?.data?.message,
                timestamp: new Date().toISOString()
            };
            console.error('Password change failed:', errorContext);
        }
    };

    const handleDeleteAccount = () => {
        if (window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
            alert('TODO:');
        }
    };

    const navOptions = [
        { title: 'General', icon: TbUser },
        { title: 'Authentication', icon: TbShield },
        { title: 'Theme', icon: TbPalette },
        { title: 'Notifications', icon: TbBell },
        { title: 'Sessions', icon: TbDeviceDesktop },
        { title: 'Integrations', icon: TbPlug },
        { title: 'Data & Export', icon: TbDownload },
        { title: 'Advanced', icon: TbSettings }
    ];

    const renderContent = () => {
        switch (activeSection) {
            case 'General':
                return (
                    <GeneralSettings
                        user={user}
                        userData={userData}
                        isUpdating={isUpdating}
                        updateError={updateError}
                        onFieldChange={handleUserDataChange}
                        onDeleteAccount={handleDeleteAccount}
                    />
                );
            case 'Authentication':
                return (
                    <AuthenticationSettings
                        isLoadingPasswordInfo={isLoadingPasswordInfo}
                        passwordInfo={passwordInfo}
                        showPasswordForm={showPasswordForm}
                        setShowPasswordForm={setShowPasswordForm}
                        passwordForm={passwordForm}
                        setPasswordForm={setPasswordForm}
                        isChangingPassword={isChangingPassword}
                        onSubmitPassword={handlePasswordChange}
                        loginActivities={loginActivities}
                        loginActivityLoading={loginActivityLoading}
                        onOpenLoginActivity={() => setShowLoginActivityModal(true)}
                    />
                );
            case 'Theme':
                return (
                    <ThemeSettings
                        currentTheme={currentTheme}
                        onThemeChange={handleThemeToggle}
                    />
                );
            case 'Notifications':
                return <NotificationsSettings />;
            case 'Sessions':
                return (
                    <SessionsSettings
                        sessions={sessions}
                        loading={sessionsLoading}
                        revokeSession={revokeSession}
                        revokeAllOtherSessions={revokeAllOtherSessions}
                    />
                );
            case 'Data & Export':
                return <DataExportSettings />;
            case 'Advanced':
                return <AdvancedSettings />;
            case 'Integrations':
                return <IntegrationsSettings />;
            default:
                return (
                    <div className='settings-content'>
                        <div className='settings-section'>
                            <Title className='settings-section-title'>{activeSection}</Title>
                            <Paragraph className='settings-section-description'>
                                Configure your {activeSection.toLowerCase()} settings.
                            </Paragraph>
                            <div className='settings-placeholder'>
                                <Paragraph>{activeSection} settings coming soon...</Paragraph>
                            </div>
                        </div>
                    </div>
                );
        }
    };

    return (
        <>
            <Container className='d-flex column account-settings-container'>
                <div className='d-flex gap-2 account-settings-layout'>
                    <SettingsSidebar
                        activeSection={activeSection}
                        navOptions={navOptions}
                        onChange={setActiveSection}
                    />

                    {/* Main Content */}
                    <main className='settings-main'>
                        <div className='settings-content-wrapper'>
                            {renderContent()}
                        </div>
                    </main>
                </div>
            </Container>

            <LoginActivityModal
                isOpen={showLoginActivityModal}
                onClose={() => setShowLoginActivityModal(false)}
            />
        </>
    );
};

export default AccountSettings;
