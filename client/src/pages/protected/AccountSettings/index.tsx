import React, { useState, useEffect } from 'react';
import { TbArrowLeft, TbUser, TbShield, TbCreditCard, TbFileText, TbLock, TbKey, TbCheck, TbX, TbEdit, TbDots, TbActivity, TbPalette, TbBell, TbDeviceDesktop, TbDownload, TbSettings, TbPlug, TbBrandGithub, TbBrandGoogle, TbBrandOpenai, TbBrain, TbCode, TbTrash, TbPlus, TbWebhook } from 'react-icons/tb';
import FormInput from '@/components/atoms/form/FormInput';
import useAuthStore from '@/stores/authentication';
import { api } from '@/services/api';
import RecentActivity from '@/components/molecules/RecentActivity';
import LoginActivityModal from '@/components/molecules/LoginActivityModal';
import ApiTokenModal from '@/components/molecules/ApiTokenModal';
import ApiTokenList from '@/components/molecules/ApiTokenList';
import WebhookModal from '@/components/molecules/WebhookModal';
import WebhookList from '@/components/molecules/WebhookList';
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
                    <div className='settings-content'>
                        {/* User Profile Section */}
                        <div className='settings-section profile-section'>
                            <div className='profile-header'>
                                <div className='profile-avatar'>
                                    <div className='avatar-circle'>
                                        {user?.firstName?.[0]}{user?.lastName?.[0]}
                                    </div>
                                </div>
                                <div className='profile-info'>
                                    <h2 className='profile-name'>{user?.firstName} {user?.lastName}</h2>
                                    <p className='profile-email'>{user?.email}</p>
                                    <div className='profile-status'>
                                        <span className='status-badge active'>
                                            <TbCheck size={14} />
                                            Active Account
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Personal Information */}
                        <div className='settings-section'>
                            <div className='section-header'>
                                <h3 className='section-title'>Personal Information</h3>
                                <p className='section-description'>Update your personal details and contact information</p>
                            </div>
                            
                            <div className='settings-form'>
                                {updateError && (
                                    <div className='update-error'>
                                        <TbX size={16} />
                                        {updateError}
                                    </div>
                                )}
                                
                                <div className='form-row'>
                                    <div className='form-field-container'>
                                        <FormInput 
                                            value={userData.firstName}
                                            label='First name'
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUserDataChange('firstName', e.target.value)}
                                            disabled={isUpdating}
                                        />
                                        {isUpdating && (
                                            <div className='update-indicator'>
                                                <TbActivity size={16} />
                                                Updating...
                                            </div>
                                        )}
                                    </div>
                                    <div className='form-field-container'>
                                        <FormInput
                                            value={userData.lastName}
                                            label='Last name'
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUserDataChange('lastName', e.target.value)}
                                            disabled={isUpdating}
                                        />
                                        {isUpdating && (
                                            <div className='update-indicator'>
                                                <TbActivity size={16} />
                                                Updating...
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className='form-field-container'>
                                    <FormInput 
                                        value={userData.email}
                                        label='Email address'
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUserDataChange('email', e.target.value)}
                                        disabled={isUpdating}
                                    />
                                    {isUpdating && (
                                        <div className='update-indicator'>
                                            <TbActivity size={16} />
                                            Updating...
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Account Activity */}
                        <div className='settings-section'>
                            <div className='section-header'>
                                <h3 className='section-title'>Account Activity</h3>
                                <p className='section-description'>Recent activity and account statistics</p>
                            </div>
                            
                            <RecentActivity 
                                limit={15} 
                                showStats={true}
                                className="account-activity-section"
                            />
                        </div>

                        {/* Account Deletion */}
                        <div className='settings-section danger-section'>
                            <div className='section-header'>
                                <h3 className='section-title'>Danger Zone</h3>
                                <p className='section-description'>Irreversible and destructive actions</p>
                            </div>
                            
                            <div className='danger-actions'>
                                <div className='danger-item'>
                                    <div className='danger-info'>
                                        <h4>Delete Account</h4>
                                        <p>Permanently delete your account and all associated data. This action cannot be undone.</p>
                                    </div>
                                    <button className='action-button danger' onClick={handleDeleteAccount}>
                                        <TbTrash size={16} />
                                        Delete Account
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'Authentication':
                return (
                    <div className='settings-content'>
                        <div className='settings-section'>
                            <div className='section-header'>
                                <h3 className='section-title'>Security Settings</h3>
                                <p className='section-description'>Manage your account security and authentication methods</p>
                            </div>
                            
                            <div className='security-grid'>
                                <div className='security-item'>
                                    <div className='security-header'>
                                        <div className='security-icon'>
                                            <TbShield size={24} />
                                        </div>
                                        <div className='security-info'>
                                            <h4>Two-Factor Authentication</h4>
                                            <p>Add an extra layer of security to your account</p>
                                        </div>
                                        <div className='security-status'>
                                            <span className='status-badge inactive'>
                                                <TbX size={14} />
                                                Disabled
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className='security-item'>
                                    <div className='security-header'>
                                        <div className='security-icon'>
                                            <TbKey size={24} />
                                        </div>
                                        <div className='security-info'>
                                            <h4>Password</h4>
                                            <p>
                                                {isLoadingPasswordInfo ? 'Loading...' : 
                                                 passwordInfo && passwordInfo.lastChanged ? 
                                                    (() => {
                                                        try {
                                                            const date = new Date(passwordInfo.lastChanged);
                                                            return isValid(date) ? 
                                                                `Last changed ${formatDistanceToNow(date, { addSuffix: true })}` : 
                                                                'Password information unavailable';
                                                        } catch {
                                                            return 'Password information unavailable';
                                                        }
                                                    })() : 
                                                 'Password information unavailable'}
                                            </p>
                                        </div>
                                        <div className='security-actions'>
                                            <button 
                                                className='action-button'
                                                onClick={() => setShowPasswordForm(!showPasswordForm)}
                                            >
                                                <TbEdit size={16} />
                                                {showPasswordForm ? 'Cancel' : 'Change'}
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {showPasswordForm && (
                                        <div className='password-form'>
                                            <form onSubmit={handlePasswordChange}>
                                                <div className='form-group'>
                                                    <FormInput
                                                        type='password'
                                                        label='Current Password'
                                                        value={passwordForm.currentPassword}
                                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                                                        required
                                                    />
                                                </div>
                                                
                                                <div className='form-group'>
                                                    <FormInput
                                                        type='password'
                                                        label='New Password'
                                                        value={passwordForm.newPassword}
                                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                                                        required
                                                        minLength={8}
                                                    />
                                                </div>
                                                
                                                <div className='form-group'>
                                                    <FormInput
                                                        type='password'
                                                        label='Confirm New Password'
                                                        value={passwordForm.confirmPassword}
                                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                                        required
                                                    />
                                                </div>
                                                
                                                <div className='form-actions'>
                                                    <button 
                                                        type='button' 
                                                        className='action-button secondary'
                                                        onClick={() => setShowPasswordForm(false)}
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button 
                                                        type='submit' 
                                                        className='action-button primary'
                                                        disabled={isChangingPassword}
                                                    >
                                                        {isChangingPassword ? 'Changing...' : 'Change Password'}
                                                    </button>
                                                </div>
                                            </form>
                                        </div>
                                    )}
                                </div>

                                <div className='security-item'>
                                    <div className='security-header'>
                                        <div className='security-icon'>
                                            <TbActivity size={24} />
                                        </div>
                                        <div className='security-info'>
                                            <h4>Login Activity</h4>
                                            <p>Monitor your account access and sessions</p>
                                        </div>
                                        <div className='security-actions'>
                                            <button 
                                                className='action-button'
                                                onClick={() => setShowLoginActivityModal(true)}
                                            >
                                                <TbDots size={16} />
                                                View
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {loginActivityLoading ? (
                                        <div className='activity-loading'>
                                            {Array.from({ length: 2 }).map((_, index) => (
                                                <div key={index} className='activity-skeleton'>
                                                    <div className='activity-skeleton-icon'></div>
                                                    <div className='activity-skeleton-content'>
                                                        <div className='activity-skeleton-line'></div>
                                                        <div className='activity-skeleton-line short'></div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className='activity-list'>
                                            {loginActivities.slice(0, 3).map((activity) => (
                                                <div key={activity._id} className={`activity-item ${activity.success ? 'success' : 'failed'}`}>
                                                    <div className='activity-icon'>
                                                        {activity.success ? <TbCheck size={16} /> : <TbX size={16} />}
                                                    </div>
                                                    <div className='activity-content'>
                                                        <div className='activity-header'>
                                                            <span className='activity-title'>
                                                                {activity.action === 'login' ? 'Login' : 
                                                                 activity.action === 'failed_login' ? 'Failed Login' : 
                                                                 'Logout'}
                                                            </span>
                                                            <span className='activity-time'>
                                                                {(() => {
                                                                    try {
                                                                        const date = new Date(activity.createdAt);
                                                                        return isValid(date) ? 
                                                                            formatDistanceToNow(date, { addSuffix: true }) : 
                                                                            'Unknown time';
                                                                    } catch {
                                                                        return 'Unknown time';
                                                                    }
                                                                })()}
                                                            </span>
                                                        </div>
                                                        <p className='activity-description'>
                                                            {activity.userAgent} • {activity.ip}
                                                            {activity.failureReason && ` • ${activity.failureReason}`}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
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
                    <div className='settings-content'>
                        <div className='settings-section'>
                            <div className='section-header'>
                                <h3 className='section-title'>Active Sessions</h3>
                                <p className='section-description'>Manage your active login sessions across devices</p>
                            </div>
                            
                            {sessionsLoading ? (
                                <div className='sessions-loading'>
                                    <div className='session-skeleton'>
                                        <div className='session-skeleton-icon'></div>
                                        <div className='session-skeleton-content'>
                                            <div className='session-skeleton-line'></div>
                                            <div className='session-skeleton-line short'></div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className='sessions-list'>
                                    {sessions.map((session, index) => (
                                        <div key={session._id} className={`session-item ${index === 0 ? 'current' : ''}`}>
                                            <div className='session-info'>
                                                <div className='session-icon'>
                                                    <TbDeviceDesktop size={20} />
                                                </div>
                                                <div className='session-details'>
                                                    <span className='session-device'>
                                                        {index === 0 ? 'Current Session' : 'Active Session'}
                                                    </span>
                                                    <span className='session-location'>
                                                        {session.userAgent} • {session.ip} • Last active {formatDistanceToNow(new Date(session.lastActivity), { addSuffix: true })}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className='session-actions'>
                                                {index === 0 ? (
                                                    <span className='status-badge active'>
                                                        <TbCheck size={14} />
                                                        Current
                                                    </span>
                                                ) : (
                                                    <button 
                                                        className='action-button danger'
                                                        onClick={() => revokeSession(session._id)}
                                                    >
                                                        <TbX size={16} />
                                                        Revoke
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    
                                    {sessions.length > 1 && (
                                        <div className='session-actions-bulk'>
                                            <button 
                                                className='action-button danger'
                                                onClick={revokeAllOtherSessions}
                                            >
                                                <TbX size={16} />
                                                Revoke All Other Sessions
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
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
                                    <button className='action-button'>
                                        <TbActivity size={16} />
                                        Contact Support
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
                    {/* Sidebar */}
                    <aside className='settings-sidebar'>
                        <div className='sidebar-header'>
                            <button className='back-button'>
                                <TbArrowLeft size={20} />
                            </button>
                            <h1 className='sidebar-title'>Settings</h1>
                        </div>
                        
                        <nav className='sidebar-nav'>
                            {navOptions.map((option) => {
                                const Icon = option.icon;
                                const isActive = activeSection === option.title;
                                
                                return (
                                    <button
                                        key={option.title}
                                        className={`nav-item ${isActive ? 'active' : ''}`}
                                        onClick={() => setActiveSection(option.title)}
                                    >
                                        <Icon size={20} />
                                        <span>{option.title}</span>
                                    </button>
                                );
                            })}
                        </nav>
                    </aside>

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