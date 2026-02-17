import { useMemo } from 'react';
import { IoSettingsOutline } from 'react-icons/io5';
import { useLocation, useNavigate } from 'react-router';
import { TbHelp } from 'react-icons/tb';
import Container from '@/shared/presentation/components/Container';
import SidebarNavItem from '@/shared/presentation/components/SidebarNavItem';
import SidebarExpandableSection from '@/shared/presentation/components/SidebarExpandableSection';

interface SidebarFooterNavigationProps {
    setSettingsExpanded: (status: boolean) => void;
    settingsExpanded: boolean;
    collapsed?: boolean;
};

const SidebarFooterNavigation = ({ settingsExpanded, setSettingsExpanded, collapsed = false }: SidebarFooterNavigationProps) => {
    const { pathname } = useLocation();
    const navigate = useNavigate();

    const settingsSubItems = useMemo(() => [
        { label: 'General', isSelected: pathname === '/dashboard/settings/general', onClick: () => navigate('/dashboard/settings/general') },
        { label: 'Authentication', isSelected: pathname === '/dashboard/settings/authentication', onClick: () => navigate('/dashboard/settings/authentication') },
        { label: 'Theme', isSelected: pathname === '/dashboard/settings/theme', onClick: () => navigate('/dashboard/settings/theme') },
        { label: 'Notifications', isSelected: pathname === '/dashboard/settings/notifications', onClick: () => navigate('/dashboard/settings/notifications') },
        { label: 'Sessions', isSelected: pathname === '/dashboard/settings/sessions', onClick: () => navigate('/dashboard/settings/sessions') },
        { label: 'Integrations', isSelected: pathname === '/dashboard/settings/integrations', onClick: () => navigate('/dashboard/settings/integrations') },
        { label: 'Data & Export', isSelected: pathname === '/dashboard/settings/data-export', onClick: () => navigate('/dashboard/settings/data-export') },
        { label: 'Advanced', isSelected: pathname === '/dashboard/settings/advanced', onClick: () => navigate('/dashboard/settings/advanced') }
    ], [pathname, navigate]);

    if (collapsed) {
        return (
            <Container className='sidebar-footer-nav'>
                <SidebarNavItem
                    label='Settings'
                    icon={IoSettingsOutline}
                    isSelected={pathname.startsWith('/dashboard/settings')}
                    onClick={() => navigate('/dashboard/settings/general')}
                />

                <SidebarNavItem
                    label='Support'
                    icon={TbHelp}
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
                label='Support'
                icon={TbHelp}
            />
        </Container>
    );
};

export default SidebarFooterNavigation;
