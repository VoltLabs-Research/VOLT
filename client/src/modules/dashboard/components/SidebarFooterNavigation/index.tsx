import { getDashboardNavigationItems } from '@/app/routes/metadata';
import { DashboardNavigationSection } from '@/app/routes/types';
import { useMemo } from 'react';
import { BookOpen, Settings } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import SidebarNavItem from '@/shared/presentation/components/SidebarNavItem';
import SidebarExpandableSection from '@/shared/presentation/components/SidebarExpandableSection';
import { useSingleTenant } from '@/modules/system/hooks/use-single-tenant';
import { Box, Tooltip } from '@voltstack/bravais';
interface SidebarFooterNavigationProps {
    setSettingsExpanded: (status: boolean) => void;
    settingsExpanded: boolean;
    collapsed?: boolean;
}

const SETTINGS_NAVIGATION_ITEMS = getDashboardNavigationItems(DashboardNavigationSection.Settings);

const SidebarFooterNavigation = ({ settingsExpanded, setSettingsExpanded, collapsed = false }: SidebarFooterNavigationProps) => {
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const singleTenant = useSingleTenant();
    const settingsItems = singleTenant ? SETTINGS_NAVIGATION_ITEMS.filter((item) => !item.multiTenantOnly) : SETTINGS_NAVIGATION_ITEMS;
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
            <Box className='sidebar-footer-nav'>
                <Tooltip content='Settings' placement='right'>
                    <SidebarNavItem
                        label='Settings'
                        icon={Settings}
                        isSelected={settingsActive}
                        onClick={() => navigate(defaultSettingsPath)}
                    />
                </Tooltip>

                <Tooltip content='Read the docs' placement='right'>
                    <SidebarNavItem
                        label='Read the docs'
                        icon={BookOpen}
                        onClick={handleOpenDocs}
                    />
                </Tooltip>
            </Box>
        );
    }

    return (
        <Box className='sidebar-footer-nav'>
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
        </Box>
    );
};

export default SidebarFooterNavigation;
