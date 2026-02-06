import React from 'react';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import SettingsSection from '@/modules/auth/presentation/components/atoms/SettingsSection';
import SettingsSectionHeader from '@/modules/auth/presentation/components/molecules/SettingsSectionHeader';
import ThemeSelector from '@/modules/auth/presentation/components/organisms/ThemeSelector';

const ThemeSettings: React.FC = () => {
    return (
        <Container className="settings-page-container d-flex column gap-3 p-2">
            <Title className="font-size-5 font-weight-6">
                Theme Settings
            </Title>

            <SettingsSection>
                <SettingsSectionHeader
                    title="Appearance"
                    description="Choose your preferred theme for the interface"
                />

                <ThemeSelector />
            </SettingsSection>
        </Container>
    );
};

export default ThemeSettings;
