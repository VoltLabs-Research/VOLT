import { getDashboardNavigationItems } from '@/app/routes/metadata';
import { DASHBOARD_NAVIGATION_ICONS } from '@/app/routes/navigation-icons';
import { DashboardNavigationSection } from '@/app/routes/types';
import useVisibleNavigationItems from '@/modules/dashboard/hooks/use-visible-navigation-items';
import NavItem from '@/shared/ui/components/NavItem';
import SidebarPanel from '@/shared/ui/components/SidebarPanel';
import { Tooltip } from '@heroui/react';
import { ArrowLeft } from 'lucide-react';
import { useLocation } from 'react-router-dom';

interface SettingsNavProps {
    active: boolean;
    collapsed: boolean;
}

const SETTINGS_NAVIGATION_ITEMS = getDashboardNavigationItems(DashboardNavigationSection.Settings);

const SettingsNav = ({ active, collapsed }: SettingsNavProps) => {
    const { pathname } = useLocation();
    const visibleNavigationItems = useVisibleNavigationItems();

    return (
        <SidebarPanel name='settings' label='Settings navigation' active={active}>
            <Tooltip isDisabled={!collapsed}>
                <Tooltip.Trigger className='w-full' role='presentation' tabIndex={-1}>
                    <NavItem label='Back to app' icon={ArrowLeft} to='/dashboard' collapsed={collapsed} />
                </Tooltip.Trigger>
                <Tooltip.Content placement='right'>Back to app</Tooltip.Content>
            </Tooltip>

            {visibleNavigationItems(SETTINGS_NAVIGATION_ITEMS).map((item) => {
                const iconPair = item.icon ? DASHBOARD_NAVIGATION_ICONS[item.icon] : null;

                return (
                    <Tooltip key={item.path} isDisabled={!collapsed}>
                        <Tooltip.Trigger className='w-full' role='presentation' tabIndex={-1}>
                            <NavItem
                                label={item.label}
                                icon={iconPair?.inactive}
                                to={item.path}
                                isActive={pathname === item.path}
                                collapsed={collapsed}
                            />
                        </Tooltip.Trigger>
                        <Tooltip.Content placement='right'>{item.label}</Tooltip.Content>
                    </Tooltip>
                );
            })}
        </SidebarPanel>
    );
};

export default SettingsNav;
