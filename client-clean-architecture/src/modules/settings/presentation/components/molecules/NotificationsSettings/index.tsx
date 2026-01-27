import React from 'react';
import { TbBell, TbActivity, TbCheck, TbX } from 'react-icons/tb';
import Section from '@/modules/settings/presentation/components/atoms/Section';
import SectionHeader from '@/modules/settings/presentation/components/atoms/SectionHeader';
import StatusBadge from '@/shared/presentation/components/atoms/common/StatusBadge';
import Container from '@/shared/presentation/components/primitives/Container';
import SettingsRow from '@/modules/settings/presentation/components/atoms/SettingsRow';
import '@/modules/settings/presentation/components/molecules/NotificationsSettings/NotificationsSettings.css';

const NotificationsSettings: React.FC = () => {
    const notifications = [{
        key: "email",
        icon: TbBell,
        title: "Email Notifications",
        description: "Receive updates via email",
        badge: (
            <StatusBadge variant="active">
                <TbCheck size={14} />
                Enabled
            </StatusBadge>
        )
    }, {
        key: "security",
        icon: TbActivity,
        title: "Security Alerts",
        description: "Get notified about security events",
        badge: (
            <StatusBadge variant="active">
                <TbCheck size={14} />
                Enabled
            </StatusBadge>
        )
    }, {
        key: "team",
        icon: TbBell,
        title: "Team Updates",
        description: "Notifications about team activities",
        badge: (
            <StatusBadge variant="inactive">
                <TbX size={14} />
                Disabled
            </StatusBadge>
        )
    }];

    return (
        <Section>
            <SectionHeader
                title="Notification Preferences"
                description="Manage how and when you receive notifications"
            />

            <Container className="d-flex gap-1 column">
                {notifications.map((item) => (
                    <SettingsRow
                        key={item.key}
                        icon={item.icon}
                        title={item.title}
                        description={item.description}
                        right={<Container className="a-self-end">{item.badge}</Container>}
                        className="sm:column sm:items-start sm:gap-1"
                        infoClassName="notification-info"
                        rightClassName=""
                    />
                ))}
            </Container>
        </Section>
    );
};

export default NotificationsSettings;
