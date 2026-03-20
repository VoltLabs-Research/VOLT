import { getDashboardNavigationItems } from '@/app/routes/metadata';
import { DashboardNavigationSection } from '@/app/routes/types';
import { useMemo } from 'react';
import { IoSettingsOutline } from 'react-icons/io5';
import { useLocation, useNavigate } from 'react-router';
import { TbBook } from 'react-icons/tb';
import Container from '@/shared/presentation/components/Container';
import SidebarNavItem from '@/shared/presentation/components/SidebarNavItem';
import SidebarExpandableSection from '@/shared/presentation/components/SidebarExpandableSection';

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

    if (collapsed) {
        return (
            <Container className='sidebar-footer-nav'>
                <SidebarNavItem
                    label='Settings'
                    icon={IoSettingsOutline}
                    isSelected={pathname.startsWith('/dashboard/settings')}
                    onClick={() => navigate(defaultSettingsPath)}
                />

                <SidebarNavItem
                    label='Read the docs'
                    icon={TbBook}
                    onClick={handleOpenDocs}
                />
            </Container>
        );
    }

    return (
        <Container className='sidebar-footer-nav'>
            <SidebarExpandableSection
                label='Settings'
                icon={IoSettingsOutline}
                isActive={pathname.startsWith('/dashboard/settings')}
                subItems={settingsSubItems}
                expanded={settingsExpanded}
                onExpandedChange={setSettingsExpanded}
            />

            <SidebarNavItem
                label='Read the docs'
                icon={TbBook}
                onClick={handleOpenDocs}
            />
        </Container>
    );
};

export default SidebarFooterNavigation;
