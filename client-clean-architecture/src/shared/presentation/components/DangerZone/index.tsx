import React from 'react';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import Button from '@/shared/presentation/components/Button';
import SettingsSection from '@/modules/auth/presentation/components/atoms/SettingsSection';
import SettingsSectionHeader from '@/modules/auth/presentation/components/molecules/SettingsSectionHeader';
import './DangerZone.css';

interface DangerZoneProps{
    title: string;
    description: string;
    actionLabel: string;
    actionIcon?: React.ReactNode;
    onAction: () => void;
}

const DangerZone: React.FC<DangerZoneProps> = ({
    title,
    description,
    actionLabel,
    actionIcon,
    onAction
}) => {
    return (
        <SettingsSection>
            <SettingsSectionHeader
                title="Danger Zone"
                description="Irreversible actions that affect your account"
            />

            <Container className="danger-zone p-1 b-radius-08">
                <Container className="d-flex items-center content-between gap-1 sm:column">
                    <Container className="d-flex column gap-025">
                        <Title className="font-size-2 font-weight-6">
                            {title}
                        </Title>
                        <Container className="color-muted font-size-1">
                            {description}
                        </Container>
                    </Container>
                    <Button
                        intent="danger"
                        variant="outline"
                        leftIcon={actionIcon}
                        onClick={onAction}
                    >
                        {actionLabel}
                    </Button>
                </Container>
            </Container>
        </SettingsSection>
    );
};

export default DangerZone;
