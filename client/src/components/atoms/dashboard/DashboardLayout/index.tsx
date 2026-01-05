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
import { IoMenuOutline } from 'react-icons/io5';
import { IoNotificationsOutline } from "react-icons/io5";
import { GoPersonAdd } from "react-icons/go";
import { useTeamStore } from '@/stores/slices/team';
import { useTrajectoryStore } from '@/stores/slices/trajectory';
import { useAnalysisConfigStore } from '@/stores/slices/analysis';
import { useNotificationStore } from '@/stores/slices/notification';
import { useAuthStore } from '@/stores/slices/auth';
import { Skeleton } from '@mui/material';
import TeamCreator from '@/components/organisms/team/TeamCreator';
import TeamInvitePanel from '@/components/organisms/team/TeamInvitePanel';
import Container from '@/components/primitives/Container';
import Popover from '@/components/molecules/common/Popover';
import Title from '@/components/primitives/Title';
import { IoChevronForward } from 'react-icons/io5';
import { usePluginStore } from '@/stores/slices/plugin/plugin-slice';
import GlobalSearch from '@/components/molecules/dashboard/GlobalSearch';
import DashboardSidebar from '@/components/organisms/dashboard/Sidebar';
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
    const selectedTeam = useTeamStore((state) => state.selectedTeam);
    const setSelectedTeam = useTeamStore((state) => state.setSelectedTeam);
    const user = useAuthStore((state) => state.user);
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();

    const trajectories = useTrajectoryStore((state) => state.trajectories);
    const getTrajectories = useTrajectoryStore((state) => state.getTrajectories);
    const { notifications, loading, fetch, markAsRead, unreadCount, initializeSocket } = useNotificationStore();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const notificationBodyRef = useRef<HTMLDivElement | null>(null);
    const observedNotificationsRef = useRef<Set<string>>(new Set());

    const markAllAsRead = useNotificationStore((state) => state.markAllAsRead);
    const fetchPlugins = usePluginStore(state => state.fetchPlugins);
    const getAnalysisConfigs = useAnalysisConfigStore((state) => state.getAnalysisConfigs);

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

    const notificationList = useMemo(() => notifications, [notifications]);

    // Settings sub-items for collapsible section
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
 
    return (
        <main className='dashboard-main d-flex vh-max'>
            <TeamCreator isRequired={teams.length === 0} />

            {/* Sidebar Overlay for Mobile */}
            <div
                className={`sidebar-overlay ${sidebarOpen ? 'is-open' : ''}`}
                onClick={() => setSidebarOpen(false)}
            />

            <DashboardSidebar
                sidebarOpen={sidebarOpen}
                setSidebarOpen={setSidebarOpen} />

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
