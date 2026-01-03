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
import { IoSettingsOutline, IoCubeOutline, IoSearchOutline, IoCloseOutline, IoMenuOutline, IoChevronDown, IoAnalytics, IoPeopleOutline, IoKeyOutline } from 'react-icons/io5';
import { RiHomeSmile2Fill } from "react-icons/ri";
import { IoNotificationsOutline } from "react-icons/io5";
import { CiChat1 } from 'react-icons/ci';
import { GoPersonAdd, GoWorkflow } from "react-icons/go";
import { HiOutlineDotsVertical } from "react-icons/hi";
import { TbHelp, TbCube3dSphere } from 'react-icons/tb';
import { useTeamStore } from '@/stores/slices/team';
import { useTrajectoryStore } from '@/stores/slices/trajectory';
import { useRasterStore } from '@/stores/slices/raster';
import { useAnalysisConfigStore } from '@/stores/slices/analysis';
import { useEditorStore } from '@/stores/slices/editor';
import { useUIStore } from '@/stores/slices/ui';
import { useNotificationStore } from '@/stores/slices/notification';
import { useAuthStore } from '@/stores/slices/auth';
import Select from '@/components/atoms/form/Select';
import useToast from '@/hooks/ui/use-toast';
import { Skeleton } from '@mui/material';
import type { IconType } from 'react-icons';
import { IoIosAdd } from 'react-icons/io';
import TeamCreator from '@/components/organisms/team/TeamCreator';
import TeamInvitePanel from '@/components/organisms/team/TeamInvitePanel';
import { useContainerStore } from '@/stores/slices/container';
import Container from '@/components/primitives/Container';
import Popover from '@/components/molecules/common/Popover';
import PopoverMenuItem from '@/components/atoms/common/PopoverMenuItem';
import Title from '@/components/primitives/Title';
import Paragraph from '@/components/primitives/Paragraph';
import { IoChevronForward } from 'react-icons/io5';
import { HiOutlineServer } from 'react-icons/hi2';
import { MdImportExport } from 'react-icons/md';
import { usePluginStore } from '@/stores/slices/plugin/plugin-slice';
import { NodeType } from '@/types/plugin';
import { BsFiles } from 'react-icons/bs';
import GlobalSearch from '@/components/molecules/dashboard/GlobalSearch';
import './DashboardLayout.css';

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
    const [searchParams, setSearchParams] = useSearchParams();

    const trajectories = useTrajectoryStore((state) => state.trajectories);
    const getTrajectories = useTrajectoryStore((state) => state.getTrajectories);
    const { notifications, loading, fetch, markAsRead, unreadCount, initializeSocket } = useNotificationStore();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const notificationBodyRef = useRef<HTMLDivElement | null>(null);
    const observedNotificationsRef = useRef<Set<string>>(new Set());

    const fetchNotifications = useNotificationStore((state) => state.fetch);
    const markAllAsRead = useNotificationStore((state) => state.markAllAsRead);
    const notificationsInitialized = useRef(false);
    const fetchPlugins = usePluginStore(state => state.fetchPlugins);
    const fetchContainers = useContainerStore(state => state.fetchContainers);
    const getAnalysisConfigs = useAnalysisConfigStore((state) => state.getAnalysisConfigs);
    const plugins = usePluginStore(state => state.plugins);
    const [analysesExpanded, setAnalysesExpanded] = useState(() => pathname.includes('/analysis-configs') || pathname.includes('/plugins/'));
    const [expandedPlugins, setExpandedPlugins] = useState<Set<string>>(() => new Set());

    const fetchMembers = useTeamStore((state) => state.fetchMembers);
    const owner = useTeamStore((state) => state.owner);
    const admins = useTeamStore((state) => state.admins);

    useEffect(() => {
        if (selectedTeam?._id) {
            fetchMembers(selectedTeam._id);
        }
    }, [selectedTeam, fetchMembers]);

    const canInvite = useMemo(() => {
        if (!user || !owner) return false;
        // Check if user is owner
        if (owner._id === user._id || (owner as any).user?._id === user._id) return true;
        // Check if user is admin
        return admins.some(admin => admin._id === user._id || (admin as any).user?._id === user._id);
    }, [user, owner, admins]);

    useEffect(() => {
        fetchPlugins();
    }, []);

    // Group plugins with their exposures that have listings or perAtomProperties
    const pluginsWithExposures = useMemo(() => {
        const result: Array<{
            pluginName: string;
            pluginSlug: string;
            exposures: Array<{ name: string; slug: string; hasPerAtomProperties: boolean }>;
        }> = [];

        plugins.forEach(plugin => {
            if (!plugin.workflow?.nodes || !plugin.workflow?.edges || !plugin.slug) return;
            const { nodes, edges } = plugin.workflow;

            // Find visualizer nodes with listings OR perAtomProperties
            const visualizerNodes = nodes.filter(node =>
                node.type === NodeType.VISUALIZERS && (
                    (node.data?.visualizers?.listing && Object.keys(node.data.visualizers.listing).length > 0) ||
                    (node.data?.visualizers?.perAtomProperties && node.data.visualizers.perAtomProperties.length > 0)
                )
            );

            if (visualizerNodes.length === 0) return;

            // Trace backward from visualizers to find connected exposures
            const findConnectedExposure = (nodeId: string, depth = 0): string | null => {
                if (depth > 5) return null;
                const incomingEdge = edges.find(e => e.target === nodeId);
                if (!incomingEdge) return null;
                const sourceNode = nodes.find(n => n.id === incomingEdge.source);
                if (!sourceNode) return null;
                if (sourceNode.type === NodeType.EXPOSURE) {
                    return sourceNode.data?.exposure?.name || null;
                }
                return findConnectedExposure(sourceNode.id, depth + 1);
            };

            const exposures: Array<{ name: string; slug: string; hasPerAtomProperties: boolean }> = [];
            const seenExposures = new Set<string>();

            visualizerNodes.forEach(vizNode => {
                const exposureName = findConnectedExposure(vizNode.id);
                if (exposureName && !seenExposures.has(exposureName)) {
                    seenExposures.add(exposureName);
                    const hasPerAtomProperties = Boolean(
                        vizNode.data?.visualizers?.perAtomProperties?.length
                    );
                    exposures.push({ name: exposureName, slug: exposureName, hasPerAtomProperties });
                }
            });

            if (exposures.length === 0) return;

            // Get modifier name for plugin display name
            const modifierNode = nodes.find(n => n.type === NodeType.MODIFIER);
            const pluginName = modifierNode?.data?.modifier?.name || plugin.slug;

            result.push({
                pluginName,
                pluginSlug: plugin.slug,
                exposures
            });
        });

        return result;
    }, [plugins]);

    const notificationList = useMemo(() => notifications, [notifications]);

    const mainNavItems: Array<[string, IconType, string]> = useMemo(() => ([
        ['Dashboard', RiHomeSmile2Fill, '/dashboard'],
        ['Containers', IoCubeOutline, '/dashboard/containers'],
        ['Trajectories', TbCube3dSphere, '/dashboard/trajectories/list'],
    ]), []);

    const secondaryNavItems: Array<[string, IconType, string]> = useMemo(() => ([
        ['Plugins', GoWorkflow, '/dashboard/plugins/list'],
        ['Messages', CiChat1, '/dashboard/messages'],
        ['Clusters', HiOutlineServer, '/dashboard/clusters'],
        ['File Explorer', BsFiles, '/dashboard/file-explorer'],
        ['Import', MdImportExport, '/dashboard/ssh-connections'],
        ['My Team', IoPeopleOutline, '/dashboard/my-team'],
        ['Manage Roles', IoKeyOutline, '/dashboard/manage-roles']
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

    const [settingsExpanded, setSettingsExpanded] = useState(() => pathname.startsWith('/dashboard/settings'));
    const activeSettingsTab = searchParams.get('tab') || 'general';

    const [teamsInitialized, setTeamsInitialized] = useState(false);

    // Track if initial data has been loaded for the current team
    const teamDataLoadedRef = useRef<string | null>(null);

    useEffect(() => {
        if (selectedTeam === null || trajectories.length) return;
        setTeamsInitialized(true);
    }, [selectedTeam, trajectories]);

    useEffect(() => {
        // Only load if we have a team and haven't loaded for this team yet
        if (!selectedTeam?._id) return;
        if (teamDataLoadedRef.current === selectedTeam._id) return;

        teamDataLoadedRef.current = selectedTeam._id;

        // These functions should have internal guards against duplicate requests
        getTrajectories(selectedTeam._id, { page: 1, limit: 20 });
        getAnalysisConfigs(selectedTeam._id, { page: 1, limit: 20 });
    }, [selectedTeam?._id, getTrajectories, getAnalysisConfigs]);

    // These are handled by useAppInitializer, no need to call again
    // useEffect(() => {
    //     getUserTeams();
    // }, [getUserTeams]);

    // useEffect(() => {
    //     initializeSocket();
    //     fetch(); // Load initial notifications from server
    // }, [initializeSocket, fetch]);

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
        } else if (!urlTeamId && storedTeamId) {
            const team = teams.find(t => t._id === storedTeamId);
            if (team) {
                setSearchParams({ team: storedTeamId });
            }
        } else if (!urlTeamId && !storedTeamId && teams.length > 0) {
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
        const { resetModel } = useEditorStore.getState();
        const { resetTimesteps } = useEditorStore.getState();
        const { resetPlayback } = useEditorStore.getState();
        const { resetEditorUI } = useUIStore.getState();
        const { reset: resetRenderConfig } = useEditorStore.getState().renderConfig;

        resetTrajectories();
        clearFrameCache();
        resetAnalysisConfig();
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
                const { resetModel } = useEditorStore.getState();
                const { resetTimesteps } = useEditorStore.getState();
                const { resetPlayback } = useEditorStore.getState();
                const { resetEditorUI } = useUIStore.getState();
                const { reset: resetRenderConfig } = useEditorStore.getState().renderConfig;

                resetTrajectories();
                clearFrameCache();
                resetAnalysisConfig();
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

    const [isSigningOut, setIsSigningOut] = useState(false);

    const handleSignOut = async () => {
        try {
            setIsSigningOut(true);
            await useAuthStore.getState().signOut();
        } catch (error) {
            console.error('Sign out failed', error);
        } finally {
            setIsSigningOut(false);
        }
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
                    {mainNavItems.map(([name, Icon, to], index) => (
                        <button
                            key={index}
                            className={`sidebar-nav-item ${(to === '/dashboard' ? pathname === to : pathname.startsWith(to)) ? 'is-selected' : ''}`}
                            onClick={() => {
                                navigate(to);
                                setSidebarOpen(false);
                                setSettingsExpanded(false);
                            }}
                        >
                            <span className='sidebar-nav-icon'>
                                <Icon />
                            </span>
                            <span className='sidebar-nav-label'>{name}</span>
                        </button>
                    ))}

                    {/* Analysis Configs Dropdown */}
                    <button
                        className={`sidebar-nav-item sidebar-section-header ${pathname.includes('/analysis-configs') ? 'is-selected' : ''}`}
                        onClick={() => setAnalysesExpanded(!analysesExpanded)}
                    >
                        <span className="sidebar-nav-icon">
                            <IoAnalytics />
                        </span>
                        <span className="sidebar-nav-label">Analysis</span>
                        <IoChevronDown
                            className={`sidebar-section-chevron ${analysesExpanded ? 'is-expanded' : ''}`}
                            size={14}
                        />
                    </button>

                    {analysesExpanded && (
                        <div className="sidebar-sub-items">
                            <button
                                className={`sidebar-sub-item ${pathname === '/dashboard/analysis-configs/list' && !searchParams.get('plugin') ? 'is-selected' : ''}`}
                                onClick={() => {
                                    navigate('/dashboard/analysis-configs/list');
                                    setSidebarOpen(false);
                                }}
                            >
                                View all
                            </button>
                            {pluginsWithExposures.map((plugin) => (
                                <div key={plugin.pluginSlug} className="sidebar-nested-section">
                                    <button
                                        className={`sidebar-sub-item sidebar-nested-header ${pathname.includes(`/plugins/${plugin.pluginSlug}/listing/`) ? 'is-selected' : ''}`}
                                        onClick={() => {
                                            setExpandedPlugins(prev => {
                                                const next = new Set(prev);
                                                if (next.has(plugin.pluginSlug)) {
                                                    next.delete(plugin.pluginSlug);
                                                } else {
                                                    next.add(plugin.pluginSlug);
                                                }
                                                return next;
                                            });
                                        }}
                                        title={plugin.pluginName}
                                    >
                                        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                            {plugin.pluginName}
                                        </span>
                                        <IoChevronDown
                                            className={`sidebar-nested-chevron ${expandedPlugins.has(plugin.pluginSlug) ? 'is-expanded' : ''}`}
                                            size={12}
                                        />
                                    </button>
                                    {expandedPlugins.has(plugin.pluginSlug) && (
                                        <div className="sidebar-nested-items">
                                            {plugin.exposures.map((exposure) => (
                                                <button
                                                    key={exposure.slug}
                                                    className={`sidebar-nested-item ${pathname.includes(`/plugins/${plugin.pluginSlug}/listing/${encodeURIComponent(exposure.slug)}`) ? 'is-selected' : ''}`}
                                                    onClick={() => {
                                                        navigate(`/dashboard/plugins/${plugin.pluginSlug}/listing/${encodeURIComponent(exposure.slug)}`);
                                                        setSidebarOpen(false);
                                                    }}
                                                    title={exposure.name}
                                                >
                                                    <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {exposure.name}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {secondaryNavItems.map(([name, Icon, to], index) => (
                        <button
                            key={index}
                            className={`sidebar-nav-item ${(to === '/dashboard' ? pathname === to : pathname.startsWith(to)) ? 'is-selected' : ''}`}
                            onClick={() => {
                                navigate(to);
                                setSidebarOpen(false);
                                setSettingsExpanded(false);
                            }}
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
                                        className={`sidebar-sub-item ${pathname === `/dashboard/settings/${item.id}` ? 'is-selected' : ''}`}
                                        onClick={() => navigate(`/dashboard/settings/${item.id}`)}
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
                    <Popover
                        id="sidebar-user-menu-popover"
                        className='gap-1'
                        trigger={
                            <button
                                className='sidebar-user-section'
                                style={{ background: 'none', border: 'none', textAlign: 'left', width: '100%' }}
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
                            </button>
                        }
                    >
                        <PopoverMenuItem icon={<IoSettingsOutline />} onClick={() => navigate('/dashboard/settings/general')}>
                            Account Settings
                        </PopoverMenuItem>
                        <PopoverMenuItem
                            icon={<IoCloseOutline />}
                            onClick={handleSignOut}
                            isLoading={isSigningOut}
                        >
                            Sign Out
                        </PopoverMenuItem>
                    </Popover>
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
                                {(() => {
                                    const segments = pathname.split('/').filter(Boolean).slice(1);
                                    const formatSegment = (segment: string) => {
                                        const decoded = decodeURIComponent(segment);
                                        return routeLabels[decoded] || capitalize(decoded);
                                    };

                                    // If more than 2 segments, show: Dashboard > ... > Last
                                    if (segments.length > 2) {
                                        const lastSegment = segments[segments.length - 1];
                                        return (
                                            <>
                                                <Container className='d-flex items-center gap-05'>
                                                    <IoChevronForward className='breadcrumb-separator color-text-muted' size={14} />
                                                    <span className='breadcrumb-item color-text-muted'>...</span>
                                                </Container>
                                                <Container className='d-flex items-center gap-05'>
                                                    <IoChevronForward className='breadcrumb-separator color-text-muted' size={14} />
                                                    <span className='breadcrumb-item breadcrumb-current color-primary font-weight-5'>
                                                        {formatSegment(lastSegment)}
                                                    </span>
                                                </Container>
                                            </>
                                        );
                                    }

                                    // Otherwise show all segments normally
                                    return segments.map((segment, index, arr) => (
                                        <Container key={segment} className='d-flex items-center gap-05'>
                                            <IoChevronForward className='breadcrumb-separator color-text-muted' size={14} />
                                            <span className={`breadcrumb-item ${index === arr.length - 1 ? 'breadcrumb-current color-primary font-weight-5' : 'breadcrumb-link color-secondary cursor-pointer'}`}>
                                                {formatSegment(segment)}
                                            </span>
                                        </Container>
                                    ));
                                })()}
                            </nav>
                        )}
                    </Container>

                    {/* Center: Search */}
                    <Container className='dashboard-header-center'>
                        <GlobalSearch />
                    </Container>



                    <Container className='dashboard-header-right'>
                        {canInvite ? (
                            <Popover
                                id="invite-members-popover"
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
                                {(closePopover) => selectedTeam && (
                                    <TeamInvitePanel
                                        teamName={selectedTeam.name}
                                        teamId={selectedTeam._id}
                                        onClose={closePopover}
                                    />
                                )}
                            </Popover>
                        ) : (
                            <button
                                className='d-flex content-center items-center badge-container as-icon-container over-light-bg'
                                title='You must be an admin or owner to invite members'
                                style={{ cursor: 'not-allowed', opacity: 0.6 }}
                                disabled
                            >
                                <GoPersonAdd size={18} />
                            </button>
                        )}

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
                                onOpenChange={(isOpen) => {
                                    if (isOpen) markAllAsRead();
                                }}
                            >
                                {(closePopover) => (
                                    <>
                                        <Container className='d-flex items-center content-between color-primary font-weight-6 dashboard-notifications-header'>
                                            <span>Notifications</span>
                                            <button
                                                className='dashboard-notifications-close color-secondary cursor-pointer'
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    closePopover();
                                                }}
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
                                                                closePopover();
                                                            }}
                                                        >
                                                            <div className='dashboard-notification-title font-weight-6 color-primary'>{n.title}</div>
                                                            <div className='dashboard-notification-content color-secondary'>{n.content}</div>
                                                        </div>
                                                    ))}
                                                </>
                                            )}
                                        </Container>
                                    </>
                                )}
                            </Popover>
                        </Container>
                    </Container>
                </header>

                <Container className='dashboard-content-main'>
                    <Outlet />
                </Container>
            </Container>
        </main>
    );
};

export default DashboardLayout;
