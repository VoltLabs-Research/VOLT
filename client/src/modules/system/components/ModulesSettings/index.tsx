import SettingsPage from '@/shared/ui/components/SettingsPage';
import SettingsSectionHeader from '@/shared/ui/components/SettingsSectionHeader';
import SettingsRow from '@/modules/auth/components/SettingsRow';
import { getDashboardNavigationItems } from '@/app/routes/metadata';
import { DashboardNavigationSection } from '@/app/routes/types';
import { resolveNavigationIcon } from '@/app/routes/navigation-icons';
import { isHideableModule } from '@/modules/system/constants/hideable-modules';
import { useEnabledModules } from '@/modules/system/hooks/use-module-enabled';
import { useHiddenModules } from '@/modules/system/hooks/use-hidden-modules';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import { LiquidToggle, Stack, Text } from '@voltstack/bravais';
import type { DashboardNavigationItem } from '@/app/routes/metadata';

type HideableModule = DashboardNavigationItem & { moduleKey: string };

const ModulesSettings = () => {
    const enabledModules = useEnabledModules();
    const { hidden, toggle } = useHiddenModules();
    const { canAccess: canAccessPermissions } = useTeamPermissions();

    const seen = new Set<string>();
    const hideableModules: HideableModule[] = [];

    for (const item of [
        ...getDashboardNavigationItems(DashboardNavigationSection.Main),
        ...getDashboardNavigationItems(DashboardNavigationSection.Secondary)
    ]) {
        const moduleKey = item.moduleKey;

        if (!isHideableModule(moduleKey) || seen.has(moduleKey)) {
            continue;
        }

        if (enabledModules !== null && !enabledModules.includes(moduleKey)) {
            continue;
        }

        if (!canAccessPermissions(item.requiredPermissions, item.permissionMode)) {
            continue;
        }

        seen.add(moduleKey);
        hideableModules.push({
            ...item,
            moduleKey
        });
    }

    hideableModules.sort((left, right) => left.label.localeCompare(right.label));

    return (
        <SettingsPage title='Modules'>
            <Stack border='soft' gap='1' p='1-5' radius='md'>
                <SettingsSectionHeader
                    title='Your modules'
                    description="Turn off features you don't use. They're removed from your navigation and never loaded — this only affects your account, not other members."
                />

                {hideableModules.length === 0 ? (
                    <Text as='p' tone='muted' size='sm'>
                        No optional modules are available to customize.
                    </Text>
                ) : (
                    <Stack gap='025'>
                        {hideableModules.map(({ moduleKey, label, icon }) => {
                            const Icon = resolveNavigationIcon(icon);
                            const isOn = !hidden.includes(moduleKey);

                            return (
                                <SettingsRow
                                    key={moduleKey}
                                    icon={<Icon size={18} aria-hidden />}
                                    title={label}
                                    rightContent={(
                                        <LiquidToggle
                                            pressed={isOn}
                                            onChange={() => toggle(moduleKey)}
                                            aria-label={`Show ${label} in navigation`}
                                        />
                                    )}
                                />
                            );
                        })}
                    </Stack>
                )}
            </Stack>
        </SettingsPage>
    );
};

export default ModulesSettings;
