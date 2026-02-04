import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useSearchParamsState from '@/shared/presentation/hooks/use-search-params';
import { RiHomeSmile2Fill } from 'react-icons/ri';
import { TbCube3dSphere } from 'react-icons/tb';
import { IoCubeOutline, IoAnalytics, IoPeopleOutline, IoKeyOutline } from 'react-icons/io5';
import { GoWorkflow } from 'react-icons/go';
import { CiChat1 } from 'react-icons/ci';
import { HiOutlineServer } from 'react-icons/hi';
import { MdImportExport } from 'react-icons/md';
import { IoIosAdd } from 'react-icons/io';
import type { IconType } from 'react-icons';
import Container from '@/shared/presentation/components/Container';
import Divider from '@/shared/presentation/components/Divider';
import TeamSelector from '@/modules/team/presentation/components/atoms/TeamSelector';
import SidebarNavItem from '@/shared/presentation/components/SidebarNavItem';
import SidebarExpandableSection from '@/shared/presentation/components/SidebarExpandableSection';
import './SidebarNavigation.css';

const MAIN_NAV_ITEMS: Array<[string, IconType, string]> = [
    ['Dashboard', RiHomeSmile2Fill, '/dashboard'],
    ['Containers', IoCubeOutline, '/dashboard/containers'],
];

const SECONDARY_NAV_ITEMS: Array<[string, IconType, string]> = [
    ['Plugins', GoWorkflow, '/dashboard/plugins/list'],
    ['Messages', CiChat1, '/dashboard/messages'],
    ['Clusters', HiOutlineServer, '/dashboard/clusters'],
    ['Import', MdImportExport, '/dashboard/ssh-connections'],
    ['My Team', IoPeopleOutline, '/dashboard/my-team'],
    ['Manage Roles', IoKeyOutline, '/dashboard/manage-roles']
];

interface SidebarNavigationProps {
    setSidebarOpen: (status: boolean) => void;
    setSettingsExpanded: (status: boolean) => void;
};

const SidebarNavigation = ({ setSidebarOpen, setSettingsExpanded }: SidebarNavigationProps) => {
    const { searchParams } = useSearchParamsState();
    const navigate = useNavigate();
    const { pathname } = useLocation();

    const handleNavigate = (to: string) => {
        navigate(to);
        setSidebarOpen(false);
        setSettingsExpanded(false);
    };

    const isSelected = (to: string) => 
        to === '/dashboard' ? pathname === to : pathname.startsWith(to);

    const trajectoriesSubItems = useMemo(() => [
        {
            label: 'View All',
            isSelected: pathname === '/dashboard/trajectories/list',
            onClick: () => { navigate('/dashboard/trajectories/list'); setSidebarOpen(false); }
        },
        {
            label: 'Simulation Cells',
            isSelected: pathname === '/dashboard/simulation-cells/list',
            onClick: () => { navigate('/dashboard/simulation-cells/list'); setSidebarOpen(false); }
        }
    ], [pathname, navigate, setSidebarOpen]);

    const analysisSubItems = useMemo(() => [
        {
            label: 'View all',
            isSelected: pathname === '/dashboard/analysis-configs/list' && !searchParams.get('plugin'),
            onClick: () => { navigate('/dashboard/analysis-configs/list'); setSidebarOpen(false); }
        }
    ], [pathname, searchParams, navigate, setSidebarOpen]);

    return (
        <nav className='sidebar-nav y-auto'>
            {MAIN_NAV_ITEMS.map(([name, Icon, to], index) => (
                <SidebarNavItem
                    key={index}
                    label={name}
                    icon={Icon}
                    isSelected={isSelected(to)}
                    onClick={() => handleNavigate(to)}
                />
            ))}

            <SidebarExpandableSection
                label='Trajectories'
                icon={TbCube3dSphere}
                isActive={pathname.includes('/trajectories') || pathname.includes('/simulation-cells')}
                subItems={trajectoriesSubItems}
            />

            <SidebarExpandableSection
                label='Analysis'
                icon={IoAnalytics}
                isActive={pathname.includes('/analysis-configs')}
                subItems={analysisSubItems}
            />

            {SECONDARY_NAV_ITEMS.map(([name, Icon, to], index) => (
                <SidebarNavItem
                    key={index}
                    label={name}
                    icon={Icon}
                    isSelected={isSelected(to)}
                    onClick={() => handleNavigate(to)}
                />
            ))}

            <Divider className='sidebar-divider' />

            <Container className='sidebar-team-section'>
                <TeamSelector className='team-select' />
            </Container>

            <SidebarNavItem
                label='Create Team'
                icon={IoIosAdd}
                commandFor='team-creator-modal'
                command='show-modal'
            />
        </nav>
    );
};

export default SidebarNavigation;
