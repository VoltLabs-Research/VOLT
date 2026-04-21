import SettingsPage from '@/shared/presentation/components/SettingsPage';
import SettingsSection from '@/shared/presentation/components/SettingsSection';
import SettingsSectionHeader from '@/shared/presentation/components/SettingsSectionHeader';
import ThemeSelector from '@/modules/auth/components/ThemeSelector';

const ThemeSettings = () => {
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
