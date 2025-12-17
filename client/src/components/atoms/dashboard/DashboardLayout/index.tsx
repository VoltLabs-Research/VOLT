/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { Outlet, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { IoSettingsOutline, IoCubeOutline, IoSearchOutline, IoCloseOutline, IoMenuOutline, IoChevronDown, IoAnalytics } from 'react-icons/io5';
import { RiHomeSmile2Fill } from "react-icons/ri";
import { IoNotificationsOutline } from "react-icons/io5";
import { CiChat1 } from 'react-icons/ci';
import { GoPersonAdd, GoWorkflow } from "react-icons/go";
import { HiOutlineDotsVertical } from "react-icons/hi";
import { TbBook, TbHelp, TbCube3dSphere } from 'react-icons/tb';
import useTeamStore from '@/stores/team/team';
import useTrajectoryStore from '@/stores/trajectories';
import useRasterStore from '@/stores/raster';
import useAnalysisConfigStore from '@/stores/analysis-config';
import { useStructureAnalysisStore } from '@/stores/structure-analysis';
import useModelStore from '@/stores/editor/model';
import useTimestepStore from '@/stores/editor/timesteps';
import usePlaybackStore from '@/stores/editor/playback';
import useEditorUIStore from '@/stores/ui/editor';
import useRenderConfigStore from '@/stores/editor/render-config';
import useNotificationStore from '@/stores/notifications';
import useWindowsStore from '@/stores/ui/windows';
import useAuthStore from '@/stores/authentication';
import Select from '@/components/atoms/form/Select';
import useToast from '@/hooks/ui/use-toast';
import { Skeleton } from '@mui/material';
import type { IconType } from 'react-icons';
import useDashboardSearchStore from '@/stores/ui/dashboard-search';
import { IoIosAdd } from 'react-icons/io';
import TeamCreator from '@/components/organisms/team/TeamCreator';
import TeamInvitePanel from '@/components/organisms/team/TeamInvitePanel';
import SSHFileExplorer from '@/components/organisms/ssh/SSHFileExplorer';
import Container from '@/components/primitives/Container';
import Popover from '@/components/molecules/common/Popover';
import Title from '@/components/primitives/Title';
import Paragraph from '@/components/primitives/Paragraph';
import { IoChevronForward } from 'react-icons/io5';
import './DashboardLayout.css';
import { HiOutlineServer } from 'react-icons/hi2';
import { MdImportExport } from 'react-icons/md';

// Greeting helper functions
const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good Morning';
    if (hour >= 12 && hour < 17) return 'Good Afternoon';
    if (hour >= 17 && hour < 21) return 'Good Evening';
    return 'Good Night';
};

const capitalize = (name?: string) => {
    if (!name) return '';
    const trimmed = String(name).trim();
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
};

// Breadcrumb configuration
const routeLabels: Record<string, string> = {
    'dashboard': 'Dashboard',
    'containers': 'Containers',
    'messages': 'Messages',
    'clusters': 'Clusters',
    'settings': 'Settings'
};

const DashboardLayout = () => {
    const teams = useTeamStore((state) => state.teams);
    const isLoadingTeams = useTeamStore((state) => state.isLoading);
    const selectedTeam = useTeamStore((state) => state.selectedTeam);
    const getUserTeams = useTeamStore((state) => state.getUserTeams);
    const setSelectedTeam = useTeamStore((state) => state.setSelectedTeam);
    const leaveTeam = useTeamStore((state) => state.leaveTeam);
    const user = useAuthStore((state) => state.user);
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const { showError, showSuccess } = useToast();
    const toggleSSHFileExplorer = useWindowsStore((state) => state.toggleSSHFileExplorer);
    const showSSHFileExplorer = useWindowsStore((state) => state.showSSHFileExplorer);
    const [searchParams, setSearchParams] = useSearchParams();

    const trajectories = useTrajectoryStore((state) => state.trajectories);
    const getTrajectories = useTrajectoryStore((state) => state.getTrajectories);
    const { notifications, loading, fetch, markAsRead, unreadCount, initializeSocket } = useNotificationStore();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const notificationBodyRef = useRef<HTMLDivElement | null>(null);
    const observedNotificationsRef = useRef<Set<string>>(new Set());

    const notificationList = useMemo(() => notifications, [notifications]);
    const navItems: Array<[string, IconType, string]> = useMemo(() => ([
        ['Dashboard', RiHomeSmile2Fill, '/dashboard'],
        ['Containers', IoCubeOutline, '/dashboard/containers'],
        ['Trajectories', TbCube3dSphere, '/dashboard/trajectories/list'],
        ['Analyses', IoAnalytics, '/dashboard/analysis-configs/list'],
        ['Plugins', GoWorkflow, '/dashboard/plugins/list'],
        ['Messages', CiChat1, '/dashboard/messages'],
        ['Clusters', HiOutlineServer, '/dashboard/clusters'],
        ['Import', MdImportExport, '/dashboard/clusters']
    ]), []);

    // Settings sub-items for collapsible section
    const settingsItems = useMemo(() => ([
        { id: 'general', label: 'General', icon: IoSettingsOutline },
        { id: 'authentication', label: 'Authentication', icon: IoSettingsOutline },
        { id: 'theme', label: 'Theme', icon: IoSettingsOutline },
        { id: 'notifications', label: 'Notifications', icon: IoSettingsOutline },
        { id: 'sessions', label: 'Sessions', icon: IoSettingsOutline },
        { id: 'integrations', label: 'Integrations', icon: IoSettingsOutline },
        { id: 'data-export', label: 'Data & Export', icon: IoSettingsOutline },
        { id: 'advanced', label: 'Advanced', icon: IoSettingsOutline }
    ]), []);

    const searchQuery = useDashboardSearchStore((s) => s.query);
    const [settingsExpanded, setSettingsExpanded] = useState(() => pathname.startsWith('/dashboard/settings'));
    const activeSettingsTab = searchParams.get('tab') || 'general';

    const [teamsInitialized, setTeamsInitialized] = useState(false);

    useEffect(() => {
        if (selectedTeam === null || trajectories.length) return;
        getTrajectories(selectedTeam._id);
    }, [selectedTeam]);

    useEffect(() => {
        if (teams.length) return;
        getUserTeams().finally(() => setTeamsInitialized(true));
    }, []);

    useEffect(() => {
        if (!teamsInitialized) return;
        if (isLoadingTeams) return;

        if (teams.length === 0) {
            const modal = document.getElementById('team-creator-modal') as HTMLDialogElement;
            if (modal) modal.showModal();
        }
    }, [teamsInitialized, isLoadingTeams, teams.length]);

    useEffect(() => {
        const unsubscribe = initializeSocket();
        fetch();
        return unsubscribe;
    }, []);

    useEffect(() => {
        if (!teams.length) return;

        const urlTeamId = searchParams.get('team');
        const storedTeamId = localStorage.getItem('selectedTeamId');

        if (urlTeamId && urlTeamId !== storedTeamId) {
            const team = teams.find(t => t._id === urlTeamId);
            if (team) {
                localStorage.setItem('selectedTeamId', urlTeamId);
                setSelectedTeam(urlTeamId);
            }
        }
        else if (!urlTeamId && storedTeamId) {
            const team = teams.find(t => t._id === storedTeamId);
            if (team) {
                setSearchParams({ team: storedTeamId });
            }
        }
        else if (!urlTeamId && !storedTeamId && teams.length > 0) {
            const firstTeam = teams[0];
            setSearchParams({ team: firstTeam._id });
            localStorage.setItem('selectedTeamId', firstTeam._id);
        }
    }, [teams, searchParams, setSearchParams, setSelectedTeam]);

    useEffect(() => {
        const popoverEl = document.getElementById('notifications-popover');
        if (!popoverEl) return;

        const handleToggle = (e: Event) => {
            const toggleEvent = e as ToggleEvent;
            if (toggleEvent.newState === 'open') {
                setTimeout(() => {
                    notificationList.forEach((notification) => {
                        if (!notification.read && !observedNotificationsRef.current.has(notification._id)) {
                            observedNotificationsRef.current.add(notification._id);
                            markAsRead(notification._id);
                        }
                    });
                }, 2000);
            }
        };

        popoverEl.addEventListener('toggle', handleToggle);

        return () => {
            popoverEl.removeEventListener('toggle', handleToggle);
        };
    }, [notificationList, markAsRead]);

    useEffect(() => {
        setSidebarOpen(false);
    }, [pathname]);

    const setSearchQuery = useDashboardSearchStore((s) => s.setQuery);
    const [localQuery, setLocalQuery] = useState(searchQuery);

    useEffect(() => { setLocalQuery(searchQuery); }, [searchQuery]);

    useEffect(() => {
        const id = setTimeout(() => setSearchQuery(localQuery), 300);
        return () => clearTimeout(id);
    }, [localQuery, setSearchQuery]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 'i' || e.key === 'I')) {
                if (e.repeat) return;
                e.preventDefault();
                e.stopPropagation();
                toggleSSHFileExplorer();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [toggleSSHFileExplorer]);

    const teamOptions = useMemo(() =>
        teams.map(team => ({
            value: team._id,
            title: team.name,
            description: team.description || undefined
        })), [teams]
    );

    const handleTeamChange = (teamId: string) => {
        if (selectedTeam?._id === teamId) return;

        const { reset: resetTrajectories } = useTrajectoryStore.getState();
        const { clearFrameCache } = useRasterStore.getState();
        const { resetAnalysisConfig } = useAnalysisConfigStore.getState();
        const { reset: resetStructureAnalysis } = useStructureAnalysisStore.getState();
        const { reset: resetModel } = useModelStore.getState();
        const { reset: resetTimesteps } = useTimestepStore.getState();
        const { reset: resetPlayback } = usePlaybackStore.getState();
        const { reset: resetEditorUI } = useEditorUIStore.getState();
        const { reset: resetRenderConfig } = useRenderConfigStore.getState();

        resetTrajectories();
        clearFrameCache();
        resetAnalysisConfig();
        resetStructureAnalysis();
        resetModel();
        resetTimesteps();
        resetPlayback();
        resetEditorUI();
        resetRenderConfig();

        setSelectedTeam(teamId);
        setSearchParams({ team: teamId });
    };

    const handleLeaveTeam = async (teamId: string) => {
        try {
            await leaveTeam(teamId);

            const state = useTeamStore.getState();
            const remainingTeams = state.teams;
            const currentSelected = state.selectedTeam;

            if (currentSelected?._id === teamId && remainingTeams.length > 0) {
                const newTeamId = remainingTeams[0]._id;
                setSelectedTeam(newTeamId);

                const { reset: resetTrajectories } = useTrajectoryStore.getState();
                const { clearFrameCache } = useRasterStore.getState();
                const { resetAnalysisConfig } = useAnalysisConfigStore.getState();
                const { reset: resetStructureAnalysis } = useStructureAnalysisStore.getState();
                const { reset: resetModel } = useModelStore.getState();
                const { reset: resetTimesteps } = useTimestepStore.getState();
                const { reset: resetPlayback } = usePlaybackStore.getState();
                const { reset: resetEditorUI } = useEditorUIStore.getState();
                const { reset: resetRenderConfig } = useRenderConfigStore.getState();

                resetTrajectories();
                clearFrameCache();
                resetAnalysisConfig();
                resetStructureAnalysis();
                resetModel();
                resetTimesteps();
                resetPlayback();
                resetEditorUI();
                resetRenderConfig();

                setSearchParams({ team: newTeamId });
            }

            showSuccess(`Left team successfully`);
        } catch (err: any) {
            const errorMessage = err?.message || 'Failed to leave team';
            showError(errorMessage);
        }
    };

    const getUserInitials = () => {
        if (!user) return 'U';
        const first = user.firstName?.[0] || '';
        const last = user.lastName?.[0] || '';
        return (first + last).toUpperCase() || 'U';
    };

    return (
        <main className='dashboard-main d-flex vh-max'>
            <TeamCreator isRequired={teams.length === 0} />

            {/* Sidebar Overlay for Mobile */}
            <div
                className={`sidebar-overlay ${sidebarOpen ? 'is-open' : ''}`}
                onClick={() => setSidebarOpen(false)}
            />

            {/* Sidebar */}
            <aside className={`dashboard-sidebar ${sidebarOpen ? 'is-open' : ''}`}>
                <button
                    className='sidebar-close-btn'
                    onClick={() => setSidebarOpen(false)}
                >
                    <IoCloseOutline size={20} />
                </button>

                {/* Brand */}
                <Container className='sidebar-brand'>
                    <div className='sidebar-brand-logo'>V</div>
                    <Title className='sidebar-brand-title color-primary'>Volterra</Title>
                </Container>

                {/* Navigation */}
                <nav className='sidebar-nav'>
                    {navItems.map(([name, Icon, to], index) => (
                        <button
                            key={index}
                            className={`sidebar-nav-item ${(to === '/dashboard' ? pathname === to : pathname.startsWith(to)) ? 'is-selected' : ''}`}
                            onClick={() => navigate(to)}
                        >
                            <span className='sidebar-nav-icon'>
                                <Icon />
                            </span>
                            <span className='sidebar-nav-label'>{name}</span>
                        </button>
                    ))}

                    <div className='sidebar-divider' />

                    {/* Team Section */}
                    <Container className='sidebar-team-section'>
                        <Select
                            options={teamOptions}
                            value={selectedTeam?._id || null}
                            onChange={handleTeamChange}
                            onLeaveTeam={handleLeaveTeam}
                            className="team-select"
                        />
                    </Container>

                    <button
                        className='sidebar-nav-item'
                        commandfor="team-creator-modal"
                        command="show-modal"
                    >
                        <span className='sidebar-nav-icon'>
                            <IoIosAdd />
                        </span>
                        <span className='sidebar-nav-label'>Create Team</span>
                    </button>
                </nav>

                {/* Footer */}
                <Container className='sidebar-footer'>
                    <Container className='sidebar-footer-nav'>
                        {/* Collapsible Settings Section */}
                        <button
                            className={`sidebar-nav-item sidebar-section-header ${pathname.startsWith('/dashboard/settings') ? 'is-selected' : ''}`}
                            onClick={() => setSettingsExpanded(!settingsExpanded)}
                        >
                            <span className='sidebar-nav-icon'>
                                <IoSettingsOutline />
                            </span>
                            <span className='sidebar-nav-label'>Settings</span>
                            <IoChevronDown
                                className={`sidebar-section-chevron ${settingsExpanded ? 'is-expanded' : ''}`}
                                size={14}
                            />
                        </button>

                        {settingsExpanded && (
                            <Container className='sidebar-sub-items'>
                                {settingsItems.map((item) => (
                                    <button
                                        key={item.id}
                                        className={`sidebar-sub-item ${pathname.startsWith('/dashboard/settings') && activeSettingsTab === item.id ? 'is-selected' : ''}`}
                                        onClick={() => navigate(`/dashboard/settings?tab=${item.id}`)}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </Container>
                        )}

                        <button className='sidebar-nav-item'>
                            <span className='sidebar-nav-icon'>
                                <TbHelp />
                            </span>
                            <span className='sidebar-nav-label'>Support</span>
                        </button>
                    </Container>

                    {/* User Profile */}
                    <Container
                        className='sidebar-user-section'
                        onClick={() => navigate('/dashboard/settings?tab=general')}
                    >
                        <div className='sidebar-user-avatar'>
                            {user?.avatar ? (
                                <img src={user.avatar} alt={user.firstName} />
                            ) : (
                                getUserInitials()
                            )}
                        </div>
                        <div className='sidebar-user-info'>
                            <Paragraph className='sidebar-user-name'>
                                {user?.firstName} {user?.lastName}
                            </Paragraph>
                            <Paragraph className='sidebar-user-email'>
                                {user?.email}
                            </Paragraph>
                        </div>
                        <div className='sidebar-user-menu'>
                            <HiOutlineDotsVertical size={16} />
                        </div>
                    </Container>
                </Container>
            </aside>

            {/* Main Content */}
            <Container className='dashboard-content-wrapper'>
                {/* Top Header */}
                <header className='dashboard-top-header'>
                    <button
                        className='mobile-sidebar-trigger'
                        onClick={() => setSidebarOpen(true)}
                    >
                        <IoMenuOutline size={20} />
                    </button>

                    {/* Left: Greeting or Breadcrumbs */}
                    <Container className='dashboard-header-left'>
                        {pathname === '/dashboard' ? (
                            <Title className='header-greeting color-primary'>
                                {getGreeting()}, {capitalize(user?.firstName)}
                            </Title>
                        ) : (
                            <nav className='breadcrumb-nav d-flex items-center gap-05'>
                                <span
                                    className='breadcrumb-item breadcrumb-link color-secondary cursor-pointer'
                                    onClick={() => navigate('/dashboard')}
                                >
                                    Dashboard
                                </span>
                                {pathname.split('/').filter(Boolean).slice(1).map((segment, index, arr) => (
                                    <Container key={segment} className='d-flex items-center gap-05'>
                                        <IoChevronForward className='breadcrumb-separator color-text-muted' size={14} />
                                        <span className={`breadcrumb-item ${index === arr.length - 1 ? 'breadcrumb-current color-primary font-weight-5' : 'breadcrumb-link color-secondary cursor-pointer'}`}>
                                            {routeLabels[segment] || capitalize(segment)}
                                        </span>
                                    </Container>
                                ))}
                            </nav>
                        )}
                    </Container>

                    {/* Center: Search */}
                    <Container className='dashboard-header-center'>
                        <Container className='d-flex gap-1 search-container'>
                            <i className='search-icon-container'>
                                <IoSearchOutline />
                            </i>
                            <input
                                placeholder='Search...'
                                className='search-input h-max'
                                value={localQuery}
                                onChange={(e) => setLocalQuery(e.target.value)}
                            />
                        </Container>
                    </Container>

                    <Container className='dashboard-header-right'>
                        <Popover
                            id="team-invite-popover"
                            trigger={
                                <button
                                    className='d-flex content-center items-center badge-container as-icon-container over-light-bg'
                                    title='Invite members'
                                >
                                    <GoPersonAdd size={18} />
                                </button>
                            }
                            className="team-invite-panel glass-bg d-flex column overflow-hidden"
                            noPadding
                        >
                            {selectedTeam && (
                                <TeamInvitePanel
                                    teamName={selectedTeam.name}
                                    teamId={selectedTeam._id}
                                    popoverId="team-invite-popover"
                                />
                            )}
                        </Popover>

                        <Container className='p-relative'>
                            <Popover
                                id="notifications-popover"
                                trigger={
                                    <button
                                        className='d-flex content-center items-center badge-container as-icon-container over-light-bg dashboard-bell-trigger cursor-pointer p-relative'
                                        type="button"
                                    >
                                        <IoNotificationsOutline size={18} />
                                        {unreadCount > 0 && (
                                            <span className='d-flex items-center content-center notification-badge p-absolute'>{unreadCount > 99 ? '99+' : unreadCount}</span>
                                        )}
                                    </button>
                                }
                                className="dashboard-notifications-dropdown glass-bg p-0 overflow-auto"
                                noPadding
                            >
                                <Container className='d-flex items-center content-between color-primary font-weight-6 dashboard-notifications-header'>
                                    <span>Notifications</span>
                                    <button
                                        className='dashboard-notifications-close color-secondary cursor-pointer'
                                        commandfor="notifications-popover"
                                        command="hide-popover"
                                        onClick={(e) => e.stopPropagation()}
                                    >×</button>
                                </Container>
                                <Container ref={notificationBodyRef} className='dashboard-notifications-body'>
                                    {loading ? (
                                        Array.from({ length: 5 }).map((_, i) => (
                                            <div key={`notif-skel-${i}`} className='dashboard-notification-item'>
                                                <Skeleton variant='text' width='60%' height={20} />
                                                <Skeleton variant='text' width='90%' height={16} />
                                            </div>
                                        ))
                                    ) : (
                                        <>
                                            {notificationList.length === 0 && (
                                                <div className='dashboard-notifications-empty text-center color-secondary'>No notifications</div>
                                            )}
                                            {notificationList.map((n) => (
                                                <div
                                                    key={n._id}
                                                    className={`dashboard-notification-item ${n.read ? 'is-read' : ''} cursor-pointer`}
                                                    onClick={() => {
                                                        if (n.link) navigate(n.link);
                                                        document.getElementById('notifications-popover')?.hidePopover();
                                                    }}
                                                >
                                                    <div className='dashboard-notification-title font-weight-6 color-primary'>{n.title}</div>
                                                    <div className='dashboard-notification-content color-secondary'>{n.content}</div>
                                                </div>
                                            ))}
                                        </>
                                    )}
                                </Container>
                            </Popover>
                        </Container>
                    </Container>
                </header>

                <Outlet />
            </Container>

            {showSSHFileExplorer && (
                <SSHFileExplorer
                    onClose={toggleSSHFileExplorer}
                    onImportSuccess={() => {
                        if (selectedTeam) {
                            getTrajectories(selectedTeam._id);
                        }
                    }}
                />
            )}
        </main>
    );
};

export default DashboardLayout;
