import React from 'react';
import SettingsPage from '../SettingsPage';
import SettingsSection from '@/modules/auth/components/atoms/SettingsSection';
import SettingsSectionHeader from '@/modules/auth/components/molecules/SettingsSectionHeader';
import ThemeSelector from '@/modules/auth/components/organisms/ThemeSelector';

const ThemeSettings: React.FC = () => {
    return (
        <SettingsPage title="Theme Settings">
            <SettingsSection>
                <SettingsSectionHeader
                    title="Appearance"
                    description="Choose your preferred theme for the interface"
                />

                <ThemeSelector />
            </SettingsSection>
        </SettingsPage>
    );
};

export default ThemeSettings;
