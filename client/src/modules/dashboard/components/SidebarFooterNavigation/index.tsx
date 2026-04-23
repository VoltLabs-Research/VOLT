import { getDashboardNavigationItems } from '@/app/routes/metadata';
import { DashboardNavigationSection } from '@/app/routes/types';
import { useMemo } from 'react';
import { IoSettings, IoSettingsOutline } from 'react-icons/io5';
import { useLocation, useNavigate } from 'react-router';
import { TbBook } from 'react-icons/tb';
import SidebarNavItem from '@/shared/presentation/components/SidebarNavItem';
import SidebarExpandableSection from '@/shared/presentation/components/SidebarExpandableSection';
import { Box, Tooltip } from '@/shared/presentation/primitives';

interface SidebarFooterNavigationProps {
    setSettingsExpanded: (status: boolean) => void;
    settingsExpanded: boolean;
    collapsed?: boolean;
};

const SETTINGS_NAVIGATION_ITEMS = getDashboardNavigationItems(DashboardNavigationSection.Settings);

const SidebarFooterNavigation = ({ settingsExpanded, setSettingsExpanded, collapsed = false }: SidebarFooterNavigationProps) => {
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const defaultSettingsPath = SETTINGS_NAVIGATION_ITEMS[0]?.path ?? '/dashboard/settings/general';

    const handleOpenDocs = () => window.open('https://docs.voltcloud.dev', '_blank', 'noopener,noreferrer');

    const settingsSubItems = useMemo(() => {
        return SETTINGS_NAVIGATION_ITEMS.map((item) => ({
            label: item.label,
            isSelected: pathname === item.path,
            onClick: () => navigate(item.path)
        }));
    }, [pathname, navigate]);

    const settingsActive = pathname.startsWith('/dashboard/settings');

    if (collapsed) {
        return (
            <Box className='sidebar-footer-nav'>
                <Tooltip content='Settings' placement='right'>
                    <SidebarNavItem
                        label='Settings'
                        icon={settingsActive ? IoSettings : IoSettingsOutline}
                        isSelected={settingsActive}
                        onClick={() => navigate(defaultSettingsPath)}
                    />
                </Tooltip>

                <Tooltip content='Read the docs' placement='right'>
                    <SidebarNavItem
                        label='Read the docs'
                        icon={TbBook}
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
                icon={settingsActive ? IoSettings : IoSettingsOutline}
                isActive={settingsActive}
                subItems={settingsSubItems}
                expanded={settingsExpanded}
                onExpandedChange={setSettingsExpanded}
            />

            <SidebarNavItem
                label='Read the docs'
                icon={TbBook}
                onClick={handleOpenDocs}
            />
        </Box>
    );
};

export default SidebarFooterNavigation;
