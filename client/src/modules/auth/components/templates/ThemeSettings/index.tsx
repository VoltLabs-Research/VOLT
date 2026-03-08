import SettingsPage from '@/shared/presentation/components/SettingsPage';
import SettingsSection from '@/modules/auth/components/atoms/SettingsSection';
import SettingsSectionHeader from '@/modules/auth/components/molecules/SettingsSectionHeader';
import ThemeSelector from '@/modules/auth/components/organisms/ThemeSelector';

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
