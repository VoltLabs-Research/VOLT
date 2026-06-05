import SettingsPage from '@/shared/presentation/components/SettingsPage';
import SettingsSectionHeader from '@/shared/presentation/components/SettingsSectionHeader';
import Stack from '@/shared/presentation/primitives/Stack';
import ThemeSelector from '@/modules/auth/components/ThemeSelector';

const ThemeSettings = () => {
    return (
        <SettingsPage title="Theme Settings">
            <Stack border='soft' gap='1' p='1-5' radius='md'>
                <SettingsSectionHeader
                    title="Appearance"
                    description="Choose your preferred theme for the interface"
                />

                <ThemeSelector />
            </Stack>
        </SettingsPage>
    );
};

export default ThemeSettings;
