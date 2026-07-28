import SettingsPage from '@/shared/ui/components/SettingsPage';
import SettingsSectionHeader from '@/shared/ui/components/SettingsSectionHeader';
import SettingsRow from '@/modules/auth/components/SettingsRow';
import { getDashboardNavigationItems } from '@/app/routes/metadata';
import { DashboardNavigationSection, RoutePermissionMode } from '@/app/routes/types';
import { resolveNavigationIcon } from '@/app/routes/navigation-icons';
import { isHideableModule } from '@/modules/system/constants/hideable-modules';
import { useEnabledModules } from '@/modules/system/hooks/use-module-enabled';
import { useHiddenModules } from '@/modules/system/hooks/use-hidden-modules';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import { LiquidToggle, Stack, Text } from '@voltstack/bravais';
import { useMemo } from 'react';
import type { DashboardNavigationItem } from '@/app/routes/metadata';

interface HideableModuleEntry {
    moduleKey: string;
    label: string;
    item: DashboardNavigationItem;
}

const ModulesSettings = () => {
    const enabledModules = useEnabledModules();
    const { hidden, toggle } = useHiddenModules();
    const { canAccess: canAccessPermissions } = useTeamPermissions();

    const hideableModules = useMemo<HideableModuleEntry[]>(() => {
        const navItems = [
            ...getDashboardNavigationItems(DashboardNavigationSection.Main),
            ...getDashboardNavigationItems(DashboardNavigationSection.Secondary)
        ];

        const seen = new Set<string>();
        const entries: HideableModuleEntry[] = [];

        for (const item of navItems) {
            const moduleKey = item.moduleKey;

            if (!isHideableModule(moduleKey) || seen.has(moduleKey)) {
                continue;
            }

            const serverEnabled = enabledModules === null || enabledModules.includes(moduleKey);
            if (!serverEnabled) {
                continue;
            }

            const permissionMode = item.permissionMode === RoutePermissionMode.All ? 'all' : 'any';
            if (!canAccessPermissions(item.requiredPermissions, permissionMode)) {
                continue;
            }

            seen.add(moduleKey);
            entries.push({
                moduleKey,
                label: item.label,
                item
            });
        }

        return entries.sort((left, right) => left.label.localeCompare(right.label));
    }, [enabledModules, canAccessPermissions]);

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
                        {hideableModules.map(({ moduleKey, label, item }) => {
                            const Icon = resolveNavigationIcon(item.icon);
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
