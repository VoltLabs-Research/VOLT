import { getDashboardNavigationItems } from '@/app/routes/metadata';
import { DASHBOARD_NAVIGATION_ICONS } from '@/app/routes/navigation-icons';
import { DashboardNavigationSection } from '@/app/routes/types';
import SectionNav from '@/modules/dashboard/components/SectionNav';
import useVisibleNavigationItems from '@/modules/dashboard/hooks/use-visible-navigation-items';
import { useLocation } from 'react-router-dom';

interface SettingsNavProps {
    active: boolean;
    collapsed: boolean;
}

const SETTINGS_NAVIGATION_ITEMS = getDashboardNavigationItems(DashboardNavigationSection.Settings);

const SettingsNav = ({ active, collapsed }: SettingsNavProps) => {
    const { pathname } = useLocation();
    const visibleNavigationItems = useVisibleNavigationItems();

    const links = visibleNavigationItems(SETTINGS_NAVIGATION_ITEMS).map((item) => ({
        label: item.label,
        icon: item.icon ? DASHBOARD_NAVIGATION_ICONS[item.icon].inactive : undefined,
        to: item.path,
        isActive: pathname === item.path
    }));

    return (
        <SectionNav
            name='settings'
            title='Settings'
            backLabel='Back to app'
            backTo='/dashboard'
            links={links}
            active={active}
            collapsed={collapsed}
        />
    );
};

export default SettingsNav;
