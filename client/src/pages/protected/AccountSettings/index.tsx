import React, { useState, useEffect } from 'react';
import { TbUser, TbShield, TbCreditCard, TbFileText, TbActivity, TbLock, TbKey, TbX, TbPalette, TbBell, TbDeviceDesktop, TbDownload, TbSettings, TbPlug, TbBrandGithub, TbBrandGoogle, TbBrandOpenai, TbBrain, TbTrash, TbPlus, TbWebhook, TbCheck } from 'react-icons/tb';
import FormInput from '@/components/atoms/form/FormInput';
import useAuthStore from '@/stores/authentication';
import { api } from '@/services/api';
import LoginActivityModal from '@/components/molecules/LoginActivityModal';
import ApiTokenModal from '@/components/molecules/ApiTokenModal';
import ApiTokenList from '@/components/molecules/ApiTokenList';
import WebhookModal from '@/components/molecules/WebhookModal';
import WebhookList from '@/components/molecules/WebhookList';
import SettingsSidebar from '@/components/molecules/settings/SettingsSidebar';
import GeneralSettings from '@/components/molecules/settings/GeneralSettings';
import AuthenticationSettings from '@/components/molecules/settings/AuthenticationSettings';
import SessionsSettings from '@/components/molecules/settings/SessionsSettings';
import useSessions from '@/hooks/auth/use-sessions';
import useLoginActivity from '@/hooks/auth/use-login-activity';
import useApiTokens from '@/hooks/api/use-api-tokens';
import useWebhooks from '@/hooks/api/use-webhooks';
import { formatDistanceToNow, isValid } from 'date-fns';
import type { ApiToken, CreateTokenData, UpdateTokenData } from '@/types/models/api-token';
import type { Webhook, CreateWebhookData, UpdateWebhookData } from '@/types/models/webhook';
import './AccountSettings.css';

const AccountSettings: React.FC = () => {
    const { 
        user, 
        passwordInfo, 
        isChangingPassword, 
        isLoadingPasswordInfo,
        changePassword, 
        getPasswordInfo 
    } = useAuthStore();
    const { 
        tokens, 
        loading: tokensLoading, 
        error: tokensError,
        createToken,
        updateToken,
        deleteToken,
        regenerateToken
    } = useApiTokens();
    const { 
        webhooks, 
        loading: webhooksLoading, 
        error: webhooksError,
        createWebhook,
        updateWebhook,
        deleteWebhook,
        testWebhook
    } = useWebhooks();
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
    const [showApiTokenModal, setShowApiTokenModal] = useState(false);
    const [apiTokenModalMode, setApiTokenModalMode] = useState<'create' | 'edit'>('create');
    const [selectedToken, setSelectedToken] = useState<ApiToken | null>(null);
    const [showWebhookModal, setShowWebhookModal] = useState(false);
    const [webhookModalMode, setWebhookModalMode] = useState<'create' | 'edit'>('create');
    const [selectedWebhook, setSelectedWebhook] = useState<Webhook | null>(null);
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
            
            const response = await api.patch('/auth/me', {
                [field]: value
            });
            
            // Update local state with server response
            if (response.data?.data) {
                setUserData(prev => ({ ...prev, [field]: value }));
                console.log(`Successfully updated ${field} on server:`, value);
            }
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
        } catch (error) {
            // Error is handled by the auth store
            console.error('Password change failed:', error);
        }
    };

    const handleCreateToken = () => {
        setApiTokenModalMode('create');
        setSelectedToken(null);
        setShowApiTokenModal(true);
    };

    const handleEditToken = (token: ApiToken) => {
        setApiTokenModalMode('edit');
        setSelectedToken(token);
        setShowApiTokenModal(true);
    };

    const handleDeleteToken = async (token: ApiToken) => {
        if (window.confirm(`Are you sure you want to delete the token "${token.name}"? This action cannot be undone.`)) {
            try {
                await deleteToken(token._id);
            } catch (error: any) {
                console.error('Failed to delete token:', error);
            }
        }
    };

    const handleRegenerateToken = async (token: ApiToken) => {
        if (window.confirm(`Are you sure you want to regenerate the token "${token.name}"? The old token will be invalidated.`)) {
            try {
                await regenerateToken(token._id);
            } catch (error: any) {
                console.error('Failed to regenerate token:', error);
            }
        }
    };

    const handleApiTokenSave = async (data: CreateTokenData | UpdateTokenData) => {
        try {
            if (apiTokenModalMode === 'create') {
                await createToken(data as CreateTokenData);
            } else {
                await updateToken(selectedToken!._id, data as UpdateTokenData);
            }
            setShowApiTokenModal(false);
        } catch (error: any) {
            throw error;
        }
    };

    const handleCreateWebhook = () => {
        setWebhookModalMode('create');
        setSelectedWebhook(null);
        setShowWebhookModal(true);
    };

    const handleEditWebhook = (webhook: Webhook) => {
        setWebhookModalMode('edit');
        setSelectedWebhook(webhook);
        setShowWebhookModal(true);
    };

    const handleDeleteWebhook = async (webhook: Webhook) => {
        if (window.confirm(`Are you sure you want to delete the webhook "${webhook.name}"? This action cannot be undone.`)) {
            try {
                await deleteWebhook(webhook._id);
            } catch (error: any) {
                console.error('Failed to delete webhook:', error);
            }
        }
    };

    const handleTestWebhook = async (webhook: Webhook) => {
        try {
            await testWebhook(webhook._id);
            alert('Webhook test sent successfully!');
        } catch (error: any) {
            alert(`Webhook test failed: ${error.message}`);
        }
    };

    const handleWebhookSave = async (data: CreateWebhookData | UpdateWebhookData) => {
        try {
            if (webhookModalMode === 'create') {
                await createWebhook(data as CreateWebhookData);
            } else {
                await updateWebhook(selectedWebhook!._id, data as UpdateWebhookData);
            }
            setShowWebhookModal(false);
        } catch (error: any) {
            throw error;
        }
    };

    // Handle account deletion
    const handleDeleteAccount = () => {
        if (window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
            // Here you would typically call an API to delete the account
            console.log('Account deletion requested');
            // For now, just show an alert
            alert('Account deletion functionality would be implemented here');
        }
    };

    const navOptions = [
        { title: 'General', icon: TbUser },
        { title: 'Authentication', icon: TbShield },
        { title: 'Theme', icon: TbPalette },
        { title: 'Notifications', icon: TbBell },
        { title: 'Sessions', icon: TbDeviceDesktop },
        { title: 'Integrations', icon: TbPlug },
        { title: 'Billing Information', icon: TbCreditCard },
        { title: 'Invoices', icon: TbFileText },
        { title: 'Privacy', icon: TbLock },
        { title: 'Data & Export', icon: TbDownload },
        { title: 'Tokens', icon: TbKey },
        { title: 'Webhooks', icon: TbWebhook },
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
                    <div className='settings-content'>
                        <div className='settings-section'>
                            <div className='section-header'>
                                <h3 className='section-title'>Theme & Appearance</h3>
                                <p className='section-description'>Customize your interface appearance and preferences</p>
                            </div>
                            
                            <div className='theme-options'>
                                <div className='theme-option'>
                                    <div className='theme-preview dark'>
                                        <div className='preview-header'></div>
                                        <div className='preview-content'></div>
                                    </div>
                                    <div className='theme-info'>
                                        <h4>Dark Mode</h4>
                                        <p>{currentTheme === 'dark' ? 'Currently active' : 'Switch to dark theme'}</p>
                                    </div>
                                    <div className='theme-actions'>
                                        <button 
                                            className='action-button'
                                            onClick={() => handleThemeToggle('dark')}
                                        >
                                            {currentTheme === 'dark' ? 'Active' : 'Switch'}
                                        </button>
                                    </div>
                                </div>
                                
                                <div className='theme-option'>
                                    <div className='theme-preview light'>
                                        <div className='preview-header'></div>
                                        <div className='preview-content'></div>
                                    </div>
                                    <div className='theme-info'>
                                        <h4>Light Mode</h4>
                                        <p>Switch to light theme</p>
                                    </div>
                                    <div className='theme-actions'>
                                        <button 
                                            className='action-button'
                                            onClick={() => handleThemeToggle('light')}
                                        >
                                            {currentTheme === 'light' ? 'Active' : 'Switch'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'Notifications':
                return (
                    <div className='settings-content'>
                        <div className='settings-section'>
                            <div className='section-header'>
                                <h3 className='section-title'>Notification Preferences</h3>
                                <p className='section-description'>Manage how and when you receive notifications</p>
                            </div>
                            
                            <div className='notification-settings'>
                                <div className='notification-item'>
                                    <div className='notification-header'>
                                        <TbBell size={24} />
                                        <div className='notification-info'>
                                            <h4>Email Notifications</h4>
                                            <p>Receive updates via email</p>
                                        </div>
                                    </div>
                                    <div className='notification-toggle'>
                                        <span className='status-badge active'>
                                            <TbCheck size={14} />
                                            Enabled
                                        </span>
                                    </div>
                                </div>
                                
                                <div className='notification-item'>
                                    <div className='notification-header'>
                                        <TbActivity size={24} />
                                        <div className='notification-info'>
                                            <h4>Security Alerts</h4>
                                            <p>Get notified about security events</p>
                                        </div>
                                    </div>
                                    <div className='notification-toggle'>
                                        <span className='status-badge active'>
                                            <TbCheck size={14} />
                                            Enabled
                                        </span>
                                    </div>
                                </div>
                                
                                <div className='notification-item'>
                                    <div className='notification-header'>
                                        <TbBell size={24} />
                                        <div className='notification-info'>
                                            <h4>Team Updates</h4>
                                            <p>Notifications about team activities</p>
                                        </div>
                                    </div>
                                    <div className='notification-toggle'>
                                        <span className='status-badge inactive'>
                                            <TbX size={14} />
                                            Disabled
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
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
                return (
                    <div className='settings-content'>
                        <div className='settings-section'>
                            <div className='section-header'>
                                <h3 className='section-title'>Data & Privacy</h3>
                                <p className='section-description'>Manage your data and privacy settings</p>
                            </div>
                            
                            <div className='data-options'>
                                <div className='data-item'>
                                    <div className='data-header'>
                                        <TbDownload size={24} />
                                        <div className='data-info'>
                                            <h4>Export Data</h4>
                                            <p>Download all your data in JSON format</p>
                                        </div>
                                    </div>
                                    <div className='data-actions'>
                                        <button className='action-button'>
                                            <TbDownload size={16} />
                                            Export
                                        </button>
                                    </div>
                                </div>
                                
                                <div className='data-item'>
                                    <div className='data-header'>
                                        <TbX size={24} />
                                        <div className='data-info'>
                                            <h4>Delete Account</h4>
                                            <p>Permanently delete your account and all data</p>
                                        </div>
                                    </div>
                                    <div className='data-actions'>
                                        <button className='action-button danger'>
                                            <TbX size={16} />
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'Advanced':
                return (
                    <div className='settings-content'>
                        <div className='settings-section'>
                            <div className='section-header'>
                                <h3 className='section-title'>Advanced Settings</h3>
                                <p className='section-description'>Developer and advanced configuration options</p>
                            </div>
                            
                            <div className='advanced-settings'>
                                <div className='advanced-item'>
                                    <div className='advanced-header'>
                                        <TbSettings size={24} />
                                        <div className='advanced-info'>
                                            <h4>Debug Mode</h4>
                                            <p>Enable detailed logging and debugging information</p>
                                        </div>
                                    </div>
                                    <div className='advanced-toggle'>
                                        <span className='status-badge inactive'>
                                            <TbX size={14} />
                                            Disabled
                                        </span>
                                    </div>
                                </div>
                                
                                <div className='advanced-item'>
                                    <div className='advanced-header'>
                                        <TbActivity size={24} />
                                        <div className='advanced-info'>
                                            <h4>Analytics</h4>
                                            <p>Share usage data to improve the service</p>
                                        </div>
                                    </div>
                                    <div className='advanced-toggle'>
                                        <span className='status-badge active'>
                                            <TbCheck size={14} />
                                            Enabled
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'Integrations':
                return (
                    <div className='settings-content'>
                        <div className='settings-section'>
                            <div className='section-header'>
                                <h3 className='section-title'>Third-party Integrations</h3>
                                <p className='section-description'>Connect your account with external services and platforms</p>
                            </div>
                            
                            <div className='integrations-grid'>
                                <div className='integration-item'>
                                    <div className='integration-header'>
                                        <div className='integration-icon'>
                                            <TbBrandGithub size={24} />
                                        </div>
                                        <div className='integration-info'>
                                            <h4>GitHub</h4>
                                            <p>Sync repositories and manage code</p>
                                        </div>
                                    </div>
                                    <div className='integration-actions'>
                                        <button className='action-button'>
                                            Connect
                                        </button>
                                    </div>
                                </div>
                                
                                <div className='integration-item'>
                                    <div className='integration-header'>
                                        <div className='integration-icon'>
                                            <TbBrandGoogle size={24} />
                                        </div>
                                        <div className='integration-info'>
                                            <h4>Google Drive</h4>
                                            <p>Access and sync your files</p>
                                        </div>
                                    </div>
                                    <div className='integration-actions'>
                                        <button className='action-button'>
                                            Connect
                                        </button>
                                    </div>
                                </div>
                                
                                <div className='integration-item'>
                                    <div className='integration-header'>
                                        <div className='integration-icon'>
                                            <TbBrain size={24} />
                                        </div>
                                        <div className='integration-info'>
                                            <h4>Gemini</h4>
                                            <p>AI-powered assistance and analysis</p>
                                        </div>
                                    </div>
                                    <div className='integration-actions'>
                                        <button className='action-button'>
                                            Connect
                                        </button>
                                    </div>
                                </div>
                                
                                <div className='integration-item'>
                                    <div className='integration-header'>
                                        <div className='integration-icon'>
                                            <TbBrandOpenai size={24} />
                                        </div>
                                        <div className='integration-info'>
                                            <h4>OpenAI</h4>
                                            <p>Advanced AI models and capabilities</p>
                                        </div>
                                    </div>
                                    <div className='integration-actions'>
                                        <button className='action-button'>
                                            Connect
                                        </button>
                                    </div>
                                </div>
                            </div>
                            
                            <div className='integration-help'>
                                <h4>Need help with integrations?</h4>
                                <p>Check our documentation or contact support for assistance with setting up third-party connections.</p>
                                <div className='help-actions'>
                                    <button className='action-button'>
                                        <TbFileText size={16} />
                                        Documentation
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'Billing Information':
                return (
                    <div className='settings-content'>
                        <div className='settings-section'>
                            <div className='section-header'>
                                <h3 className='section-title'>Billing & Payment</h3>
                                <p className='section-description'>Manage your billing details and payment methods</p>
                            </div>
                            
                            <div className='coming-soon-minimal'>
                                <TbCreditCard size={48} />
                                <p>Coming soon...</p>
                            </div>
                        </div>
                    </div>
                );
            case 'Invoices':
                return (
                    <div className='settings-content'>
                        <div className='settings-section'>
                            <div className='section-header'>
                                <h3 className='section-title'>Invoices & Receipts</h3>
                                <p className='section-description'>View and download your billing documents</p>
                            </div>
                            
                            <div className='coming-soon-minimal'>
                                <TbFileText size={48} />
                                <p>Coming soon...</p>
                            </div>
                        </div>
                    </div>
                );
            case 'Privacy':
                return (
                    <div className='settings-content'>
                        <div className='settings-section'>
                            <div className='section-header'>
                                <h3 className='section-title'>Privacy & Data</h3>
                                <p className='section-description'>Control your privacy settings and data preferences</p>
                            </div>
                            
                            <div className='privacy-settings'>
                                <div className='privacy-item'>
                                    <div className='privacy-header'>
                                        <TbLock size={24} />
                                        <div className='privacy-info'>
                                            <h4>Data Collection</h4>
                                            <p>Allow collection of usage data to improve the service</p>
                                        </div>
                                    </div>
                                    <div className='privacy-toggle'>
                                        <span className='status-badge active'>
                                            <TbCheck size={14} />
                                            Enabled
                                        </span>
                                    </div>
                                </div>
                                
                                <div className='privacy-item'>
                                    <div className='privacy-header'>
                                        <TbActivity size={24} />
                                        <div className='privacy-info'>
                                            <h4>Analytics</h4>
                                            <p>Share anonymous usage statistics</p>
                                        </div>
                                    </div>
                                    <div className='privacy-toggle'>
                                        <span className='status-badge active'>
                                            <TbCheck size={14} />
                                            Enabled
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'Tokens':
                return (
                    <div className='settings-content'>
                        <div className='settings-section'>
                            <div className='section-header'>
                                <div className='section-header-content'>
                                    <h3 className='section-title'>API Tokens</h3>
                                    <p className='section-description'>Manage your API tokens for programmatic access</p>
                                </div>
                                <div className='section-header-actions'>
                                    <button 
                                        className='action-button primary'
                                        onClick={handleCreateToken}
                                    >
                                        <TbPlus size={16} />
                                        Create Token
                                    </button>
                                </div>
                            </div>
                            
                            {tokensError && (
                                <div className='error-message'>
                                    {tokensError}
                                </div>
                            )}
                            
                            <ApiTokenList
                                tokens={tokens}
                                loading={tokensLoading}
                                onEdit={handleEditToken}
                                onDelete={handleDeleteToken}
                                onRegenerate={handleRegenerateToken}
                            />
                        </div>
                    </div>
                );
            case 'Webhooks':
                return (
                    <div className='settings-content'>
                        <div className='settings-section'>
                            <div className='section-header'>
                                <div className='section-header-content'>
                                    <h3 className='section-title'>Webhooks</h3>
                                    <p className='section-description'>Configure webhooks to receive real-time notifications</p>
                                </div>
                                <div className='section-header-actions'>
                                    <button 
                                        className='action-button primary'
                                        onClick={handleCreateWebhook}
                                    >
                                        <TbPlus size={16} />
                                        Create Webhook
                                    </button>
                                </div>
                            </div>
                            
                            {webhooksError && (
                                <div className='error-message'>
                                    {webhooksError}
                                </div>
                            )}
                            
                            <WebhookList
                                webhooks={webhooks}
                                loading={webhooksLoading}
                                onEdit={handleEditWebhook}
                                onDelete={handleDeleteWebhook}
                                onTest={handleTestWebhook}
                            />
                        </div>
                    </div>
                );
            default:
                return (
                    <div className='settings-content'>
                        <div className='settings-section'>
                            <h2 className='settings-section-title'>{activeSection}</h2>
                            <p className='settings-section-description'>
                                Configure your {activeSection.toLowerCase()} settings.
                            </p>
                            <div className='settings-placeholder'>
                                <p>{activeSection} settings coming soon...</p>
                            </div>
                        </div>
                    </div>
                );
        }
    };

    return (
        <>
            <div className='account-settings-container'>
                <div className='account-settings-layout'>
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
            </div>
            
            <LoginActivityModal 
                isOpen={showLoginActivityModal}
                onClose={() => setShowLoginActivityModal(false)}
            />
            
            <ApiTokenModal
                isOpen={showApiTokenModal}
                onClose={() => setShowApiTokenModal(false)}
                onSave={handleApiTokenSave}
                token={selectedToken}
                mode={apiTokenModalMode}
            />
            
            <WebhookModal
                isOpen={showWebhookModal}
                onClose={() => setShowWebhookModal(false)}
                onSave={handleWebhookSave}
                webhook={selectedWebhook}
                mode={webhookModalMode}
            />
        </>
    );
};

export default AccountSettings;