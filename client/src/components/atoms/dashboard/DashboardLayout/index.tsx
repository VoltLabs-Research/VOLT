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
import { IoSettingsOutline, IoCubeOutline, IoMenuOutline, IoSearchOutline } from 'react-icons/io5';
import Paragraph from '@/components/primitives/Paragraph';
import Button from '@/components/primitives/Button';
import { RiHomeSmile2Fill } from "react-icons/ri";
import { IoNotificationsOutline } from "react-icons/io5";
import { CiChat1 } from 'react-icons/ci';
import { GoPersonAdd } from "react-icons/go";
import SidebarUserAvatar from '@/components/atoms/auth/SidebarUserAvatar';
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
import { TbBook } from 'react-icons/tb';
import './DashboardLayout.css';

const DashboardLayout = () => {
    const teams = useTeamStore((state) => state.teams);
    const isLoadingTeams = useTeamStore((state) => state.isLoading);
    const selectedTeam = useTeamStore((state) => state.selectedTeam);
    const getUserTeams = useTeamStore((state) => state.getUserTeams);
    const setSelectedTeam = useTeamStore((state) => state.setSelectedTeam);
    const leaveTeam = useTeamStore((state) => state.leaveTeam);
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const { showError, showSuccess } = useToast();
    const toggleSSHFileExplorer = useWindowsStore((state) => state.toggleSSHFileExplorer);
    const showSSHFileExplorer = useWindowsStore((state) => state.showSSHFileExplorer);
    const [searchParams, setSearchParams] = useSearchParams();

    const trajectories = useTrajectoryStore((state) => state.trajectories);
    const getTrajectories = useTrajectoryStore((state) => state.getTrajectories);
    const { notifications, loading, fetch, markAsRead, unreadCount, initializeSocket } = useNotificationStore();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const mobileMenuWrapperRef = useRef<HTMLDivElement | null>(null);
    const teamSelectorRef = useRef<HTMLDivElement | null>(null);
    const notificationBodyRef = useRef<HTMLDivElement | null>(null);
    const observedNotificationsRef = useRef<Set<string>>(new Set());

    const notificationList = useMemo(() => notifications, [notifications]);
    const navItems: Array<[string, IconType, string]> = useMemo(() => ([
        ['Dashboard', RiHomeSmile2Fill, '/dashboard'],
        ['Containers', IoCubeOutline, '/dashboard/containers'],
        ['Messages', CiChat1, '/dashboard/messages'],
        ['Clusters', TbBook, '/dashboard/clusters']
    ]), []);
    const searchQuery = useDashboardSearchStore((s) => s.query);

    // Track if teams have been fetched at least once
    const [teamsInitialized, setTeamsInitialized] = useState(false);

    useEffect(() => {
        if (selectedTeam === null || trajectories.length) return;
        getTrajectories(selectedTeam._id);
    }, [selectedTeam]);

    useEffect(() => {
        if (teams.length) return;
        getUserTeams().finally(() => setTeamsInitialized(true));
    }, []);

    // Force user to create a team if they don't belong to any
    // Wait for teams to finish loading first
    useEffect(() => {
        // Only check after teams have been initialized(fetched at least once)
        if (!teamsInitialized) return;
        if (isLoadingTeams) return; // Still loading, don't check yet

        if (teams.length === 0) {
            // User has no teams after loading, force team creation
            const modal = document.getElementById('team-creator-modal') as HTMLDialogElement;
            if (modal) modal.showModal();
        }
    }, [teamsInitialized, isLoadingTeams, teams.length]);

    // Initialize socket listener for notifications
    useEffect(() => {
        const unsubscribe = initializeSocket();
        // Fetch initial notifications
        fetch();
        return unsubscribe;
    }, []);

    // Handle team query param and localStorage synchronization
    useEffect(() => {
        if (!teams.length) return;

        const urlTeamId = searchParams.get('team');
        const storedTeamId = localStorage.getItem('selectedTeamId');

        // If URL has team param and it's different from localStorage, update localStorage
        if (urlTeamId && urlTeamId !== storedTeamId) {
            const team = teams.find(t => t._id === urlTeamId);
            if (team) {
                localStorage.setItem('selectedTeamId', urlTeamId);
                setSelectedTeam(urlTeamId);
            }
        }
        // If no URL param but localStorage exists, update URL
        else if (!urlTeamId && storedTeamId) {
            const team = teams.find(t => t._id === storedTeamId);
            if (team) {
                setSearchParams({ team: storedTeamId });
            }
        }
        // If no URL param and no localStorage, set first team
        else if (!urlTeamId && !storedTeamId && teams.length > 0) {
            const firstTeam = teams[0];
            setSearchParams({ team: firstTeam._id });
            localStorage.setItem('selectedTeamId', firstTeam._id);
        }
    }, [teams, searchParams, setSearchParams, setSelectedTeam]);


    // Mark notifications as read when popover opens
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
        if (!mobileMenuOpen) return;
        const onDoc = (e: MouseEvent) => {
            if (!mobileMenuWrapperRef.current) return;
            if (!mobileMenuWrapperRef.current.contains(e.target as Node)) {
                setMobileMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [mobileMenuOpen]);
    const setSearchQuery = useDashboardSearchStore((s) => s.setQuery);
    const [localQuery, setLocalQuery] = useState(searchQuery);

    // Keep local input in sync if query changes externally
    useEffect(() => { setLocalQuery(searchQuery); }, [searchQuery]);

    // Debounce updates to global query to reduce re-renders/network chatter
    useEffect(() => {
        const id = setTimeout(() => setSearchQuery(localQuery), 300);
        return () => clearTimeout(id);
    }, [localQuery, setSearchQuery]);

    // Keyboard shortcut for SSH File Explorer(Ctrl+I)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Handle both 'i' and 'I' (case-insensitive)
            if ((e.ctrlKey || e.metaKey) && (e.key === 'i' || e.key === 'I')) {
                if (e.repeat) return;
                e.preventDefault();
                e.stopPropagation();
                console.log('SSH File Explorer shortcut triggered!');
                toggleSSHFileExplorer();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [toggleSSHFileExplorer]);

    // Convert teams to Select options
    const teamOptions = useMemo(() =>
        teams.map(team => ({
            value: team._id,
            title: team.name,
            description: team.description || undefined
        })), [teams]
    );

    // Handle team selection change
    const handleTeamChange = (teamId: string) => {
        // Only proceed if it's actually a different team
        if (selectedTeam?._id === teamId) return;

        // Clean up team-dependent states
        const { reset: resetTrajectories } = useTrajectoryStore.getState();
        const { clearFrameCache } = useRasterStore.getState();
        const { resetAnalysisConfig } = useAnalysisConfigStore.getState();
        const { reset: resetStructureAnalysis } = useStructureAnalysisStore.getState();
        const { reset: resetModel } = useModelStore.getState();
        const { reset: resetTimesteps } = useTimestepStore.getState();
        const { reset: resetPlayback } = usePlaybackStore.getState();
        const { reset: resetEditorUI } = useEditorUIStore.getState();
        const { reset: resetRenderConfig } = useRenderConfigStore.getState();

        // Clear all team-dependent data
        resetTrajectories();
        clearFrameCache();
        resetAnalysisConfig();
        resetStructureAnalysis();
        resetModel();
        resetTimesteps();
        resetPlayback();
        resetEditorUI();
        resetRenderConfig();

        // Set the new selected team
        setSelectedTeam(teamId);

        // Update URL with new team
        setSearchParams({ team: teamId });
    };

    const handleLeaveTeam = async (teamId: string) => {
        try {
            await leaveTeam(teamId);

            // Get the state after leaving
            const state = useTeamStore.getState();
            const remainingTeams = state.teams;
            const currentSelected = state.selectedTeam;

            // If the left team was the selected one, switch to the first available team
            if (currentSelected?._id === teamId && remainingTeams.length > 0) {
                const newTeamId = remainingTeams[0]._id;
                setSelectedTeam(newTeamId);

                // Reset all team-dependent states
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

                // Update URL with new team
                setSearchParams({ team: newTeamId });
            }

            showSuccess(`Left team successfully`);
        } catch (err: any) {
            const errorMessage = err?.message || 'Failed to leave team';
            showError(errorMessage);
        }
    };

    return (
        <main className='dashboard-main d-flex column vh-max'>
            <TeamCreator isRequired={teams.length === 0} />

            <Container className='d-flex items-center content-between dashboard-layout-header-container'>
                <Container ref={mobileMenuWrapperRef} className='p-relative d-none sm:d-block'>
                    <Container className='d-flex content-center items-center mobile-menu-trigger badge-container as-icon-container over-light-bg p-relative p-absolute' onClick={() => setMobileMenuOpen((v) => !v)}>
                        <IoMenuOutline />
                    </Container>
                    {mobileMenuOpen && (
                        <Container className='mobile-dropdown p-absolute overflow-hidden' onMouseDown={(e) => e.stopPropagation()}>
                            <Container className='mobile-dropdown-section'>
                                <Container className='d-flex gap-1 search-container color-primary'>
                                    <i className='search-icon-container'>
                                        <IoSearchOutline />
                                    </i>
                                    <input
                                        placeholder='Search'
                                        className='search-input  h-max'
                                        value={localQuery}
                                        onChange={(e) => setLocalQuery(e.target.value)}
                                    />
                                </Container>
                            </Container>
                            <Container className='mobile-dropdown-section'>
                                <nav className='d-flex column gap-05 mobile-nav-list w-max'>
                                    {navItems.map(([name, Icon, to], index) => (
                                        <Button
                                            key={`mdrop-${index}`}
                                            variant='ghost'
                                            intent='neutral'
                                            size='sm'
                                            block
                                            align='start'
                                            className={`mobile-nav-item ${(to === '/dashboard' ? pathname === to : pathname.startsWith(to)) ? 'is-selected' : ''} color-primary`}
                                            leftIcon={<i className='mobile-nav-icon color-primary'><Icon /></i>}
                                            onClick={() => { navigate(to); setMobileMenuOpen(false); }}
                                        >
                                            <span className='mobile-nav-name'>{name}</span>
                                        </Button>
                                    ))}
                                </nav>
                            </Container>

                            <Container className='mobile-dropdown-section'>
                                <Container className='team-selector-container'>
                                    <Select
                                        options={teamOptions}
                                        value={selectedTeam?._id || null}
                                        onChange={(v) => { handleTeamChange(v); setMobileMenuOpen(false); }}
                                        placeholder="Select team"
                                        className="team-select"
                                        maxListWidth={300}
                                        renderInPortal
                                    />
                                </Container>
                                <button
                                    className='d-flex content-center items-center badge-container as-icon-container over-light-bg p-absolute'
                                    onClick={() => {
                                        setMobileMenuOpen(false);
                                        const modal = document.getElementById('team-creator-modal') as HTMLDialogElement;
                                        if (modal && !modal.open) {
                                            modal.showModal();
                                        }
                                    }}
                                >
                                    <IoIosAdd size={25} />
                                </button>
                            </Container>
                        </Container>
                    )}
                </Container>

                <Container className='d-flex items-center gap-05 navigation-container sm:d-none'>
                    {navItems.map(([name, Icon, to], index) => (
                        <Container
                            className={`d-flex cursor-pointer items-center gap-05 navigation-item-container ${(to === '/dashboard' ? pathname === to : pathname.startsWith(to)) ? 'is-selected' : ''}`}
                            key={index}
                            onClick={() => navigate(to)}
                        >
                            <i className='navigation-item-icon'>
                                <Icon />
                            </i>
                            <Paragraph className='font-size-2-5 font-weight-5 color-secondary navigation-item-name'>{name}</Paragraph>
                        </Container>
                    ))}
                </Container>

                <Container className='d-flex gap-05 items-center dashboard-search-container'>
                    <Container className='d-flex gap-1 search-container color-primary'>
                        <i className='search-icon-container'>
                            <IoSearchOutline />
                        </i>
                        <input
                            placeholder='Search'
                            className='search-input  h-max'
                            value={localQuery}
                            onChange={(e) => setLocalQuery(e.target.value)}
                        />
                    </Container>

                    <Container
                        ref={teamSelectorRef}
                        className='d-flex items-center gap-05 cursor-pointer p-05 team-selector-container'
                    >
                        <Select
                            options={teamOptions}
                            value={selectedTeam?._id || null}
                            onChange={handleTeamChange}
                            onLeaveTeam={handleLeaveTeam}
                            placeholder="Select team"
                            className="team-select"
                            maxListWidth={300}
                        />
                    </Container>

                    <Popover
                        id="team-invite-popover"
                        trigger={
                            <button
                                className='d-flex content-center items-center badge-container as-icon-container over-light-bg p-absolute'
                                title='Invite members or share team'
                                aria-label='Invite members or share team'
                            >
                                <GoPersonAdd size={20} />
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

                    <button
                        className='d-flex content-center items-center badge-container as-icon-container over-light-bg p-absolute'
                        commandfor="team-creator-modal"
                        command="show-modal"
                    >
                        <IoIosAdd size={25} />
                    </button>
                </Container>

                <Container className='d-flex gap-1-5 sm:d-flex sm:gap-05 dashboard-user-container'>
                    <Container className='d-flex content-center items-center badge-container as-icon-container over-light-bg p-absolute'>
                        <IoSettingsOutline />
                    </Container>

                    <Container className='p-relative'>
                        <Popover
                            id="notifications-popover"
                            trigger={
                                <button
                                    className='d-flex content-center items-center badge-container as-icon-container over-light-bg dashboard-bell-trigger cursor-pointer p-relative p-absolute'
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
                                        <div key={`notif-skel-${i}`} className='dashboard-notification-item cursor-pointer'>
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
                                                data-notification-id={n._id}
                                                data-notification-read={n.read}
                                                onClick={() => {
                                                    if (n.link) navigate(n.link);
                                                    // Close popover manually if navigating
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

                    <SidebarUserAvatar avatarrounded />
                </Container>
            </Container>

            <Outlet />

            {showSSHFileExplorer && (
                <SSHFileExplorer
                    onClose={toggleSSHFileExplorer}
                    onImportSuccess={() => {
                        // Refresh trajectories after import
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
