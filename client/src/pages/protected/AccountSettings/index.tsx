import React, { useState } from 'react';
import { TbArrowLeft, TbUser, TbShield, TbCreditCard, TbFileText, TbLock, TbKey, TbCheck, TbX, TbEdit, TbDots, TbCalendar, TbActivity, TbPalette, TbBell, TbDeviceDesktop, TbDownload, TbSettings } from 'react-icons/tb';
import FormInput from '@/components/atoms/form/FormInput';
import useAuthStore from '@/stores/authentication';
import './AccountSettings.css';

const AccountSettings: React.FC = () => {
    const user = useAuthStore((state) => state.user);
    const [activeSection, setActiveSection] = useState('General');

    const navOptions = [
        { title: 'General', icon: TbUser },
        { title: 'Authentication', icon: TbShield },
        { title: 'Theme', icon: TbPalette },
        { title: 'Notifications', icon: TbBell },
        { title: 'Sessions', icon: TbDeviceDesktop },
        { title: 'Billing Information', icon: TbCreditCard },
        { title: 'Invoices', icon: TbFileText },
        { title: 'Privacy', icon: TbLock },
        { title: 'Data & Export', icon: TbDownload },
        { title: 'Tokens', icon: TbKey },
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
                                <div className='form-row'>
                                    <FormInput 
                                        value={user?.firstName || ''}
                                        label='First name'
                                    />
                                    <FormInput
                                        value={user?.lastName || ''}
                                        label='Last name'
                                    />
                                </div>
                                <FormInput 
                                    value={user?.email || ''}
                                    label='Email address'
                                    disabled
                                />
                            </div>
                        </div>

                        {/* Account Activity */}
                        <div className='settings-section'>
                            <div className='section-header'>
                                <h3 className='section-title'>Account Activity</h3>
                                <p className='section-description'>Recent activity and account statistics</p>
                            </div>
                            
                            <div className='activity-grid'>
                                <div className='activity-item'>
                                    <div className='activity-icon'>
                                        <TbCalendar size={20} />
                                    </div>
                                    <div className='activity-content'>
                                        <span className='activity-label'>Member since</span>
                                        <span className='activity-value'>January 2024</span>
                                    </div>
                                </div>
                                <div className='activity-item'>
                                    <div className='activity-icon'>
                                        <TbActivity size={20} />
                                    </div>
                                    <div className='activity-content'>
                                        <span className='activity-label'>Last active</span>
                                        <span className='activity-value'>2 hours ago</span>
                                    </div>
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
                                            <p>Last changed 3 months ago</p>
                                        </div>
                                        <div className='security-actions'>
                                            <button className='action-button'>
                                                <TbEdit size={16} />
                                                Change
                                            </button>
                                        </div>
                                    </div>
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
                                            <button className='action-button'>
                                                <TbDots size={16} />
                                                View
                                            </button>
                                        </div>
                                    </div>
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
                                        <p>Currently active</p>
                                    </div>
                                    <div className='theme-status'>
                                        <span className='status-badge active'>
                                            <TbCheck size={14} />
                                            Active
                                        </span>
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
                                        <button className='action-button'>
                                            Switch
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
                            
                            <div className='sessions-list'>
                                <div className='session-item current'>
                                    <div className='session-info'>
                                        <div className='session-icon'>
                                            <TbDeviceDesktop size={20} />
                                        </div>
                                        <div className='session-details'>
                                            <span className='session-device'>Current Session</span>
                                            <span className='session-location'>Chrome on macOS • San Francisco, CA</span>
                                        </div>
                                    </div>
                                    <div className='session-status'>
                                        <span className='status-badge active'>
                                            <TbCheck size={14} />
                                            Current
                                        </span>
                                    </div>
                                </div>
                                
                                <div className='session-item'>
                                    <div className='session-info'>
                                        <div className='session-icon'>
                                            <TbDeviceDesktop size={20} />
                                        </div>
                                        <div className='session-details'>
                                            <span className='session-device'>Mobile App</span>
                                            <span className='session-location'>iOS App • Last active 2 hours ago</span>
                                        </div>
                                    </div>
                                    <div className='session-actions'>
                                        <button className='action-button danger'>
                                            <TbX size={16} />
                                            Revoke
                                        </button>
                                    </div>
                                </div>
                            </div>
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
                                <h3 className='section-title'>API Tokens</h3>
                                <p className='section-description'>Manage your API tokens for programmatic access</p>
                            </div>
                            
                            <div className='tokens-list'>
                                <div className='token-item'>
                                    <div className='token-info'>
                                        <div className='token-icon'>
                                            <TbKey size={20} />
                                        </div>
                                        <div className='token-details'>
                                            <span className='token-name'>Production API</span>
                                            <span className='token-key'>••••••••••••••••</span>
                                        </div>
                                    </div>
                                    <div className='token-actions'>
                                        <button className='action-button'>
                                            <TbEdit size={16} />
                                            Regenerate
                                        </button>
                                        <button className='action-button danger'>
                                            <TbX size={16} />
                                            Revoke
                                        </button>
                                    </div>
                                </div>
                                
                                <div className='token-item'>
                                    <div className='token-info'>
                                        <div className='token-icon'>
                                            <TbKey size={20} />
                                        </div>
                                        <div className='token-details'>
                                            <span className='token-name'>Development API</span>
                                            <span className='token-key'>••••••••••••••••</span>
                                        </div>
                                    </div>
                                    <div className='token-actions'>
                                        <button className='action-button'>
                                            <TbEdit size={16} />
                                            Regenerate
                                        </button>
                                        <button className='action-button danger'>
                                            <TbX size={16} />
                                            Revoke
                                        </button>
                                    </div>
                                </div>
                            </div>
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
    );
};

export default AccountSettings;