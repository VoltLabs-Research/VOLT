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

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
    IoPersonOutline,
    IoTelescopeOutline,
    IoSettingsOutline,
    IoChevronBack,
    IoChevronForward,
    IoSyncOutline,
    IoStatsChart,
    IoCubeOutline,
    IoCloudOutline,
    IoLayersOutline,
    IoCodeSlashOutline,
    IoMenuOutline,
    IoSearchOutline,
} from 'react-icons/io5';
import './DashboardLayout.css';
import Paragraph from '@/components/primitives/Paragraph';
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
import './DashboardLayout.css';
import Container from '@/components/primitives/Container';
import { TbBook } from 'react-icons/tb';

const DashboardLayout = () => {
    const teams = useTeamStore((state) => state.teams);
    const isLoadingTeams = useTeamStore((state) => state.isLoading);
    const selectedTeam = useTeamStore((state) => state.selectedTeam);
    const getUserTeams = useTeamStore((state) => state.getUserTeams);
    const setSelectedTeam = useTeamStore((state) => state.setSelectedTeam);
    const leaveTeam = useTeamStore((state) => state.leaveTeam);
    const navigate = useNavigate();
    const { showError, showSuccess } = useToast();
    const toggleTeamCreator = useWindowsStore((state) => state.toggleTeamCreator);
    const showTeamCreator = useWindowsStore((state) => state.showTeamCreator);
    const toggleSSHFileExplorer = useWindowsStore((state) => state.toggleSSHFileExplorer);
    const showSSHFileExplorer = useWindowsStore((state) => state.showSSHFileExplorer);
    const [searchParams, setSearchParams] = useSearchParams();

    const trajectories = useTrajectoryStore((state) => state.trajectories);
    const getTrajectories = useTrajectoryStore((state) => state.getTrajectories);
    const { notifications, loading, fetch, markAsRead, unreadCount, initializeSocket } = useNotificationStore();
    const [notifOpen, setNotifOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [invitePanelOpen, setInvitePanelOpen] = useState(false);
    const mobileMenuWrapperRef = useRef<HTMLDivElement | null>(null);
    const bellWrapperRef = useRef<HTMLDivElement | null>(null);
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

        if (teams.length === 0 && !showTeamCreator) {
            // User has no teams after loading, force team creation
            toggleTeamCreator();
        }
    }, [teamsInitialized, isLoadingTeams, teams.length, showTeamCreator, toggleTeamCreator]);

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

    useEffect(() => {
        if (notifOpen) {
            fetch({ force: true });
        } else {
            // Clear observed notifications when closing panel
            observedNotificationsRef.current.clear();
        }
    }, [notifOpen]);

    useEffect(() => {
        if (!notifOpen) return;
        const onDoc = (e: MouseEvent) => {
            if (!bellWrapperRef.current) return;
            if (!bellWrapperRef.current.contains(e.target as Node)) {
                setNotifOpen(false);
            }
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [notifOpen]);

    // Mark notifications as read when they become visible
    useEffect(() => {
        if (!notifOpen || !notificationBodyRef.current) {
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const notificationId = entry.target.getAttribute('data-notification-id');
                        const isRead = entry.target.getAttribute('data-notification-read') === 'true';

                        if (notificationId && !isRead && !observedNotificationsRef.current.has(notificationId)) {
                            observedNotificationsRef.current.add(notificationId);
                            // Mark as read after a short delay to ensure user saw it
                            setTimeout(() => {
                                markAsRead(notificationId);
                            }, 1000);
                        }
                    }
                });
            },
            {
                root: notificationBodyRef.current,
                threshold: 0.8, // 80% visible
            }
        );

        // Observe all notification items
        const notificationItems = notificationBodyRef.current.querySelectorAll('.dashboard-notification-item');
        notificationItems.forEach((item) => observer.observe(item));

        return () => {
            observer.disconnect();
        };
    }, [notifOpen, notificationList, markAsRead]);

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
                if (e.repeat) return; // Prevent multiple toggles when holding key
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
            {showTeamCreator && (
                <TeamCreator isRequired={teams.length === 0} />
            )}

            <Container className='d-flex items-center content-between dashboard-layout-header-container'>
                <Container ref={mobileMenuWrapperRef} className='p-relative d-none sm:d-block'>
                    <Container className='d-flex content-center items-center mobile-menu-trigger badge-container as-icon-container over-light-bg' onClick={() => setMobileMenuOpen((v) => !v)}>
                        <IoMenuOutline />
                    </Container>
                    {mobileMenuOpen && (
                        <Container className='mobile-dropdown' onMouseDown={(e) => e.stopPropagation()}>
                            <Container className='mobile-dropdown-section'>
                                <Container className='d-flex gap-1 search-container'>
                                    <i className='search-icon-container'>
                                        <IoSearchOutline />
                                    </i>
                                    <input
                                        placeholder='Search'
                                        className='search-input '
                                        value={localQuery}
                                        onChange={(e) => setLocalQuery(e.target.value)}
                                    />
                                </Container>
                            </Container>
                            <Container className='mobile-dropdown-section'>
                                <nav className='d-flex column gap-05 mobile-nav-list'>
                                    {navItems.map(([name, Icon, to], index) => (
                                        <button key={`mdrop-${index}`} className={`d-flex items-center gap-075 mobile-nav-item ${(index === 0) ? 'is-selected' : ''}`} onClick={() => { navigate(to); setMobileMenuOpen(false); }}>
                                            <i className='mobile-nav-icon'><Icon /></i>
                                            <span className='mobile-nav-name'>{name}</span>
                                        </button>
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
                                <div onClick={() => { toggleTeamCreator(); setMobileMenuOpen(false); }} className='d-flex content-center items-center badge-container as-icon-container over-light-bg'>
                                    <IoIosAdd size={25} />
                                </div>
                            </Container>
                        </Container>
                    )}
                </Container>
                <Container className='d-flex items-center gap-05 navigation-container sm:d-none'>
                    {navItems.map(([name, Icon, to], index) => (
                        <Container
                            className={`d-flex cursor-pointer items-center gap-05 navigation-item-container ${(index === 0) ? 'is-selected' : ''}`}
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
                    <Container className='d-flex gap-1 search-container'>
                        <i className='search-icon-container'>
                            <IoSearchOutline />
                        </i>
                        <input
                            placeholder='Search'
                            className='search-input '
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

                    <button
                        className='d-flex content-center items-center team-invite-icon-btn badge-container as-icon-container over-light-bg'
                        onClick={() => selectedTeam && setInvitePanelOpen(true)}
                        title='Invite members or share team'
                        aria-label='Invite members or share team'
                    >
                        <GoPersonAdd size={20} />
                    </button>

                    <Container
                        onClick={toggleTeamCreator}
                        className='d-flex content-center items-center badge-container as-icon-container over-light-bg'
                    >
                        <IoIosAdd size={25} />
                    </Container>
                </Container>

                <Container className='d-flex gap-1-5 sm:d-flex sm:gap-05 dashboard-user-container'>
                    <Container className='d-flex content-center items-center badge-container as-icon-container over-light-bg'>
                        <IoSettingsOutline />
                    </Container>

                    <Container ref={bellWrapperRef} className='p-relative'>
                        <Container onClick={() => setNotifOpen((v) => !v)} className='d-flex content-center items-center badge-container as-icon-container over-light-bg dashboard-bell-trigger'>
                            <IoNotificationsOutline />
                            {unreadCount > 0 && (
                                <span className='d-flex items-center content-center notification-badge'>{unreadCount > 99 ? '99+' : unreadCount}</span>
                            )}
                        </Container>
                        {notifOpen && (
                            <Container className='dashboard-notifications-dropdown'>
                                <Container className='d-flex items-center content-between color-primary font-weight-6 dashboard-notifications-header'>
                                    <span>Notifications</span>
                                    <button className='dashboard-notifications-close' onClick={(e) => { e.stopPropagation(); setNotifOpen(false); }}>×</button>
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
                                                <div className='dashboard-notifications-empty'>No notifications</div>
                                            )}
                                            {notificationList.map((n) => (
                                                <div
                                                    key={n._id}
                                                    className={`dashboard-notification-item ${n.read ? 'is-read' : ''}`}
                                                    data-notification-id={n._id}
                                                    data-notification-read={n.read}
                                                    onClick={() => { if (n.link) navigate(n.link); setNotifOpen(false); }}
                                                >
                                                    <div className='dashboard-notification-title'>{n.title}</div>
                                                    <div className='dashboard-notification-content'>{n.content}</div>
                                                </div>
                                            ))}
                                        </>
                                    )}
                                </Container>
                            </Container>
                        )}
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

            {selectedTeam && (
                <TeamInvitePanel
                    isOpen={invitePanelOpen}
                    onClose={() => setInvitePanelOpen(false)}
                    teamName={selectedTeam.name}
                    teamId={selectedTeam._id}
                    triggerRef={teamSelectorRef}
                />
            )}
        </main>
    );
};

export default DashboardLayout;
