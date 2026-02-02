import React from 'react';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import SettingsSection from '@/modules/auth/presentation/components/atoms/SettingsSection';
import SettingsSectionHeader from '@/modules/auth/presentation/components/molecules/SettingsSectionHeader';
import SettingsRow from '@/modules/auth/presentation/components/molecules/SettingsRow';
import StatusBadge from '@/shared/presentation/components/StatusBadge';
import { Bell, Mail, MessageSquare, AlertCircle } from 'lucide-react';

// TODO:
const notificationPreferences = [
    {
        id: 'email-security',
        icon: <AlertCircle size={20} />,
        title: 'Security Alerts',
        description: 'Receive notifications about account security and suspicious activity',
        enabled: true
    },
    {
        id: 'email-updates',
        icon: <Mail size={20} />,
        title: 'Product Updates',
        description: 'Stay informed about new features and improvements',
        enabled: true
    },
    {
        id: 'email-marketing',
        icon: <MessageSquare size={20} />,
        title: 'Marketing Communications',
        description: 'Receive promotional offers and newsletters',
        enabled: false
    },
    {
        id: 'push-general',
        icon: <Bell size={20} />,
        title: 'Push Notifications',
        description: 'Receive push notifications for important events',
        enabled: true
    }
];

const NotificationSettings: React.FC = () => {
    return (
        <Container className="settings-page-container d-flex column gap-3 p-2">
            <Title className="font-size-5 font-weight-6">
                Notification Settings
            </Title>

            <SettingsSection>
                <SettingsSectionHeader
                    title="Notification Preferences"
                    description="Manage how you receive notifications and updates"
                />

                <Container className="d-flex column gap-05">
                    {notificationPreferences.map((pref) => (
                        <SettingsRow
                            key={pref.id}
                            icon={pref.icon}
                            title={pref.title}
                            description={pref.description}
                            rightContent={
                                <StatusBadge variant={pref.enabled ? 'active' : 'inactive'}>
                                    {pref.enabled ? 'Enabled' : 'Disabled'}
                                </StatusBadge>
                            }
                        />
                    ))}
                </Container>
            </SettingsSection>
        </Container>
    );
};

export default NotificationSettings;
