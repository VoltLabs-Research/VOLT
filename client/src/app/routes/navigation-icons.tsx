import { DashboardNavigationIconKey } from '@/app/routes/types';
import {
    BookOpen,
    Box as CubeIcon,
    KeyRound,
    LayoutGrid,
    Lock,
    MessageCircle,
    Paintbrush,
    Sparkles,
    Users,
    Workflow
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
    [DashboardNavigationIconKey.Containers]: {
        inactive: CubeIcon,
        active: CubeIcon
    },
    [DashboardNavigationIconKey.Dashboard]: {
        inactive: LayoutGrid,
        active: LayoutGrid
    },
    [DashboardNavigationIconKey.ManageRoles]: {
        inactive: KeyRound,
        active: KeyRound
    },
    [DashboardNavigationIconKey.Messages]: {
        inactive: MessageCircle,
        active: MessageCircle
    },
    [DashboardNavigationIconKey.MyTeam]: {
        inactive: Users,
        active: Users
    },
    [DashboardNavigationIconKey.Notebooks]: {
        inactive: BookOpen,
        active: BookOpen
    },
    [DashboardNavigationIconKey.Plugins]: {
        inactive: Workflow,
        active: Workflow
    },
    [DashboardNavigationIconKey.SecretKeys]: {
        inactive: Lock,
        active: Lock
    },
    [DashboardNavigationIconKey.Whiteboards]: {
        inactive: Paintbrush,
        active: Paintbrush
    }
};
