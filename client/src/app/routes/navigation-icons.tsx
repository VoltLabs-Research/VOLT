import { DashboardNavigationIconKey } from '@/app/routes/types';
import {
    BookOpen,
    Box as CubeIcon,
    Boxes,
    FileText,
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

export interface IconPair {
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
    [DashboardNavigationIconKey.Latex]: {
        inactive: FileText,
        active: FileText
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

export const FALLBACK_NAVIGATION_ICON: LucideIcon = Boxes;

export const resolveNavigationIcon = (iconKey?: DashboardNavigationIconKey): LucideIcon => {
    if (iconKey && DASHBOARD_NAVIGATION_ICONS[iconKey]) {
        return DASHBOARD_NAVIGATION_ICONS[iconKey].inactive;
    }

    return FALLBACK_NAVIGATION_ICON;
};
