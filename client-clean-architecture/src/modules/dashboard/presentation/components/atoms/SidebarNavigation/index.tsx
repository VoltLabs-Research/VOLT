import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { RiHomeSmile2Fill } from "react-icons/ri";
import { IoCubeOutline, IoPeopleOutline, IoKeyOutline } from 'react-icons/io5';
import { GoWorkflow } from 'react-icons/go';
import { CiChat1 } from 'react-icons/ci';
import { HiOutlineServer } from 'react-icons/hi';
import { MdImportExport } from 'react-icons/md';
import type { IconType } from 'react-icons';

import SidebarTeamSelector from './components/SidebarTeamSelector';
import SidebarAnalysisNav from './components/SidebarAnalysisNav';
import SidebarTrajectoriesNav from './components/SidebarTrajectoriesNav';

interface SidebarNavigationProps {
    setSidebarOpen: (status: boolean) => void;
    setSettingsExpanded: (status: boolean) => void;
};

const SidebarNavigation = ({ setSidebarOpen, setSettingsExpanded }: SidebarNavigationProps) => {
    const navigate = useNavigate();
    const { pathname } = useLocation();

    const mainNavItems: Array<[string, IconType, string]> = useMemo(() => ([
        ['Dashboard', RiHomeSmile2Fill, '/dashboard'],
        ['Containers', IoCubeOutline, '/dashboard/containers'],
    ]), []);

    const secondaryNavItems: Array<[string, IconType, string]> = useMemo(() => ([
        ['Plugins', GoWorkflow, '/dashboard/plugins/list'],
        ['Messages', CiChat1, '/dashboard/messages'],
        ['Clusters', HiOutlineServer, '/dashboard/clusters'],
        ['Import', MdImportExport, '/dashboard/ssh-connections'],
        ['My Team', IoPeopleOutline, '/dashboard/my-team'],
        ['Manage Roles', IoKeyOutline, '/dashboard/manage-roles']
    ]), []);

    const renderNavItems = (items: Array<[string, IconType, string]>) => (
        items.map(([name, Icon, to], index) => (
            <button
                key={`${name}-${index}`}
                className={`sidebar-nav-item ${(to === '/dashboard' ? pathname === to : pathname.startsWith(to)) ? 'is-selected' : ''} p-relative gap-075 w-max font-size-2 font-weight-4 color-secondary cursor-pointer`}
                onClick={() => {
                    navigate(to);
                    setSidebarOpen(false);
                    setSettingsExpanded(false);
                }}
            >
                <span className='sidebar-nav-icon font-size-4'>
                    <Icon />
                </span>
                <span className='sidebar-nav-label'>{name}</span>
            </button>
        ))
    );

    return (
        <nav className='sidebar-nav y-auto'>
            {renderNavItems(mainNavItems)}

            <SidebarTrajectoriesNav setSidebarOpen={setSidebarOpen} />
            <SidebarAnalysisNav setSidebarOpen={setSidebarOpen} />

            {renderNavItems(secondaryNavItems)}

            <SidebarTeamSelector />
        </nav>
    );
};

export default SidebarNavigation;