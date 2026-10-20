import { DashboardNavigationIconKey } from '@/app/routes/types';
import {
    BookOpen,
    KeyRound,
    LayoutGrid,
    MonitorSmartphone,
    Paintbrush,
    Plug,
    ShieldCheck,
    SlidersHorizontal,
    Sparkles,
    Users
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface IconPair {
    inactive: LucideIcon;
    active: LucideIcon;
}

export const DASHBOARD_NAVIGATION_ICONS: Record<DashboardNavigationIconKey, IconPair> = {
    [DashboardNavigationIconKey.AI]: {
        inactive: Sparkles,
        active: Sparkles
    },
    [DashboardNavigationIconKey.Dashboard]: {
        inactive: LayoutGrid,
        active: LayoutGrid
    },
    [DashboardNavigationIconKey.ManageRoles]: {
        inactive: KeyRound,
        active: KeyRound
    },
    [DashboardNavigationIconKey.MyTeam]: {
        inactive: Users,
        active: Users
    },
    [DashboardNavigationIconKey.Notebooks]: {
        inactive: BookOpen,
        active: BookOpen
    },
    [DashboardNavigationIconKey.Whiteboards]: {
        inactive: Paintbrush,
        active: Paintbrush
    },
    [DashboardNavigationIconKey.SettingsGeneral]: {
        inactive: SlidersHorizontal,
        active: SlidersHorizontal
    },
    [DashboardNavigationIconKey.SettingsAuthentication]: {
        inactive: ShieldCheck,
        active: ShieldCheck
    },
    [DashboardNavigationIconKey.SettingsIntegrations]: {
        inactive: Plug,
        active: Plug
    },
    [DashboardNavigationIconKey.SettingsSessions]: {
        inactive: MonitorSmartphone,
        active: MonitorSmartphone
    },
    [DashboardNavigationIconKey.SecretKeys]: {
        inactive: KeyRound,
        active: KeyRound
    }
};
