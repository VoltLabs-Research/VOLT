import { getDashboardNavigationItems } from '@/app/routes/metadata';
import { DashboardNavigationSection } from '@/app/routes/types';
import { useMemo } from 'react';
import { BookOpen, Settings } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import SidebarNavItem from '@/shared/ui/components/SidebarNavItem';
import SidebarExpandableSection from '@/shared/ui/components/SidebarExpandableSection';
import useVisibleNavigationItems from '@/modules/dashboard/hooks/use-visible-navigation-items';
import { Tooltip } from '@heroui/react';
import {
    RAIL_FOOTER_NAV,
    RAIL_FOOTER_NAV_COLLAPSED,
    RAIL_TOOLTIP_TRIGGER
} from '@/modules/dashboard/components/collapsed-rail-chrome';

interface SidebarFooterNavigationProps {
    setSettingsExpanded: (status: boolean) => void;
    settingsExpanded: boolean;
    collapsed?: boolean;
}

const SETTINGS_NAVIGATION_ITEMS = getDashboardNavigationItems(DashboardNavigationSection.Settings);

const SidebarFooterNavigation = ({ settingsExpanded, setSettingsExpanded, collapsed = false }: SidebarFooterNavigationProps) => {
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const visibleNavigationItems = useVisibleNavigationItems();
    const settingsItems = visibleNavigationItems(SETTINGS_NAVIGATION_ITEMS);
    const defaultSettingsPath = settingsItems[0]?.path ?? '/dashboard/settings/general';

    const handleOpenDocs = () => window.open('https://docs.voltcloud.dev', '_blank', 'noopener,noreferrer');

    const settingsSubItems = useMemo(() => {
        return settingsItems.map((item) => ({
            label: item.label,
            isSelected: pathname === item.path,
            onClick: () => navigate(item.path)
        }));
    }, [pathname, navigate, settingsItems]);

    const settingsActive = pathname.startsWith('/dashboard/settings');

    if (collapsed) {
        return (
            <div className={RAIL_FOOTER_NAV_COLLAPSED}>
                <Tooltip>
                    <Tooltip.Trigger className={RAIL_TOOLTIP_TRIGGER} role='presentation' tabIndex={-1}>
                        <SidebarNavItem
                            label='Settings'
                            icon={Settings}
                            isSelected={settingsActive}
                            onClick={() => navigate(defaultSettingsPath)}
                        />
                    </Tooltip.Trigger>
                    <Tooltip.Content placement='right'>Settings</Tooltip.Content>
                </Tooltip>

                <Tooltip>
                    <Tooltip.Trigger className={RAIL_TOOLTIP_TRIGGER} role='presentation' tabIndex={-1}>
                        <SidebarNavItem
                            label='Read the docs'
                            icon={BookOpen}
                            onClick={handleOpenDocs}
                        />
                    </Tooltip.Trigger>
                    <Tooltip.Content placement='right'>Read the docs</Tooltip.Content>
                </Tooltip>
            </div>
        );
    }

    return (
        <div className={RAIL_FOOTER_NAV}>
            <SidebarExpandableSection
                label='Settings'
                icon={Settings}
                isActive={settingsActive}
                subItems={settingsSubItems}
                expanded={settingsExpanded}
                onExpandedChange={setSettingsExpanded}
            />

            <SidebarNavItem
                label='Read the docs'
                icon={BookOpen}
                onClick={handleOpenDocs}
            />
        </div>
    );
};

export default SidebarFooterNavigation;
