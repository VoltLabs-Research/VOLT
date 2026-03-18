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

const SidebarFooterNavigation = ({ settingsExpanded, setSettingsExpanded, collapsed = false }: SidebarFooterNavigationProps) => {
    const { pathname } = useLocation();
    const navigate = useNavigate();

    const handleOpenDocs = () => window.open('https://docs.voltcloud.dev', '_blank', 'noopener,noreferrer');

    const settingsSubItems = useMemo(() => [
        {
            label: 'General',
            isSelected: pathname === '/dashboard/settings/general',
            onClick: () => navigate('/dashboard/settings/general')
        },
        {
            label: 'Authentication',
            isSelected: pathname === '/dashboard/settings/authentication',
            onClick: () => navigate('/dashboard/settings/authentication')
        },
        {
            label: 'Theme',
            isSelected: pathname === '/dashboard/settings/theme',
            onClick: () => navigate('/dashboard/settings/theme')
        },
        {
            label: 'Sessions',
            isSelected: pathname === '/dashboard/settings/sessions',
            onClick: () => navigate('/dashboard/settings/sessions')
        },
        {
            label: 'Integrations',
            isSelected: pathname === '/dashboard/settings/integrations',
            onClick: () => navigate('/dashboard/settings/integrations')
        }
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
