import SettingsPage from '@/shared/ui/components/SettingsPage';
import SettingsSectionHeader from '@/shared/ui/components/SettingsSectionHeader';
import ThemeSelector from '@/modules/auth/components/ThemeSelector';

const ThemeSettings = () => {
    return (
        <SettingsPage title="Theme Settings">
            <div className='flex flex-col gap-4 p-6 rounded-xl border border-border'>
                <SettingsSectionHeader
                    title="Appearance"
                    description="Choose your preferred theme for the interface"
                />

                <ThemeSelector />
            </div>
        </SettingsPage>
    );
};

export default ThemeSettings;
