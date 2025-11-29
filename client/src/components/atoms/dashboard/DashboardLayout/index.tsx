/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
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
**/

import { useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useNavigate, useSearchParams } from 'react-router-dom';
import { TbCube3dSphere } from "react-icons/tb";
import { IoSearchOutline, IoSettingsOutline, IoMenuOutline } from "react-icons/io5";
import { TbBook } from 'react-icons/tb';
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
import ShortcutsModal from '@/components/organisms/common/ShortcutsModal';
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
import './DashboardLayout.css';

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

    // Memoized values - must be declared before useEffect
    const notificationList = useMemo(() => notifications, [notifications]);
    const navItems: Array<[string, IconType, string]> = useMemo(() => ([
        ['Dashboard', RiHomeSmile2Fill, '/dashboard'],
        ['Messages', CiChat1, '/dashboard/messages'],
        ['Studio', TbCube3dSphere, ''],
        ['Clusters', TbBook, '/dashboard/clusters']
    ]), []);
    const searchQuery = useDashboardSearchStore((s) => s.query);
    
    // Track if teams have been fetched at least once
    const [teamsInitialized, setTeamsInitialized] = useState(false);

    useEffect(() => {
        if(selectedTeam === null || trajectories.length) return;
        getTrajectories(selectedTeam._id);
    }, [selectedTeam]);   

    useEffect(() => {
        if(teams.length) return;
        getUserTeams().finally(() => setTeamsInitialized(true));
    }, []);

    // Force user to create a team if they don't belong to any
    // Wait for teams to finish loading first
    useEffect(() => {
        // Only check after teams have been initialized (fetched at least once)
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
        if(notifOpen) {
            fetch({ force: true });
        } else {
            // Clear observed notifications when closing panel
            observedNotificationsRef.current.clear();
        }
    }, [notifOpen]);

    useEffect(() => {
        if(!notifOpen) return;
        const onDoc = (e: MouseEvent) => {
            if(!bellWrapperRef.current) return;
            if(!bellWrapperRef.current.contains(e.target as Node)){
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
        if(!mobileMenuOpen) return;
        const onDoc = (e: MouseEvent) => {
            if(!mobileMenuWrapperRef.current) return;
            if(!mobileMenuWrapperRef.current.contains(e.target as Node)){
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
        <main className='dashboard-main'>
            {showTeamCreator && (
                <TeamCreator isRequired={teams.length === 0} />
            )}

            <section className='dashboard-layout-header-container'>
                <div ref={mobileMenuWrapperRef} className='mobile-menu-wrapper'>
                    <div className='mobile-menu-trigger badge-container as-icon-container over-light-bg' onClick={() => setMobileMenuOpen((v) => !v)}>
                        <IoMenuOutline />
                    </div>
                    {mobileMenuOpen && (
                        <div className='mobile-dropdown' onMouseDown={(e) => e.stopPropagation()}>
                            <div className='mobile-dropdown-section'>
                                <div className='search-container'>
                                    <i className='search-icon-container'>
                                        <IoSearchOutline />
                                    </i>
                                    <input
                                        placeholder='Search'
                                        className='search-input '
                                        value={localQuery}
                                        onChange={(e) => setLocalQuery(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className='mobile-dropdown-section'>
                                <nav className='mobile-nav-list'>
                                    {navItems.map(([ name, Icon, to ], index) => (
                                        <button key={`mdrop-${index}`} className={`mobile-nav-item ${(index === 0) ? 'is-selected' : ''}`} onClick={() => { navigate(to); setMobileMenuOpen(false); }}>
                                            <i className='mobile-nav-icon'><Icon /></i>
                                            <span className='mobile-nav-name'>{name}</span>
                                        </button>
                                    ))}
                                </nav>
                            </div>
                            <div className='mobile-dropdown-section'>
                                <div className='team-selector-container'>
                                    <Select
                                        options={teamOptions}
                                        value={selectedTeam?._id || null}
                                onChange={(v) => { handleTeamChange(v); setMobileMenuOpen(false); }}
                                        placeholder="Select team"
                                        className="team-select"
                                maxListWidth={300}
                                renderInPortal
                                    />
                                </div>
                                <div onClick={() => { toggleTeamCreator(); setMobileMenuOpen(false); }} className='badge-container as-icon-container over-light-bg'>
                                    <IoIosAdd size={25} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <nav className='navigation-container'>
                    {navItems.map(([ name, Icon, to ], index) => (
                        <div 
                            className={`navigation-item-container ${(index === 0) ? 'is-selected' : ''}`}
                            key={index}
                            onClick={() => navigate(to)}
                        >
                            <i className='navigation-item-icon'>
                                <Icon />
                            </i>
                            <p className='navigation-item-name'>{name}</p>                           
                        </div> 
                    ))}
                </nav>

                <div className='dashboard-search-container'>
                    <div className='search-container'>
                        <i className='search-icon-container'>
                            <IoSearchOutline />
                        </i>
                        <input
                            placeholder='Search'
                            className='search-input '
                            value={localQuery}
                            onChange={(e) => setLocalQuery(e.target.value)}
                        />
                    </div>
                    
                    <div 
                        ref={teamSelectorRef}
                        className='team-selector-container'
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
                    </div>

                    <button
                        className='team-invite-icon-btn badge-container as-icon-container over-light-bg'
                        onClick={() => selectedTeam && setInvitePanelOpen(true)}
                        title='Invite members or share team'
                        aria-label='Invite members or share team'
                    >
                        <GoPersonAdd size={20} />
                    </button>

                    <div 
                        onClick={toggleTeamCreator}
                        className='badge-container as-icon-container over-light-bg'
                    >
                        <IoIosAdd size={25} />
                    </div>
                </div>

                <div className='dashboard-user-container'>
                    <div className='badge-container as-icon-container over-light-bg'>
                        <IoSettingsOutline />
                    </div>

                    <div ref={bellWrapperRef} className='dashboard-bell-wrapper'>
                        <div onClick={() => setNotifOpen((v) => !v)} className='badge-container as-icon-container over-light-bg dashboard-bell-trigger'>
                            <IoNotificationsOutline />
                            {unreadCount > 0 && (
                                <span className='notification-badge'>{unreadCount > 99 ? '99+' : unreadCount}</span>
                            )}
                        </div>
                        {notifOpen && (
                            <div className='dashboard-notifications-dropdown'>
                                <div className='dashboard-notifications-header'>
                                    <span>Notifications</span>
                                    <button className='dashboard-notifications-close' onClick={(e) => { e.stopPropagation(); setNotifOpen(false); }}>×</button>
                                </div>
                                <div ref={notificationBodyRef} className='dashboard-notifications-body'>
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
                                                    onClick={() => { if(n.link) navigate(n.link); setNotifOpen(false); }}
                                                >
                                                    <div className='dashboard-notification-title'>{n.title}</div>
                                                    <div className='dashboard-notification-content'>{n.content}</div>
                                                </div>
                                            ))}
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <SidebarUserAvatar avatarrounded />
                </div>
            </section>

            {/* Floating dropdown replaces side panel */}
                
            <Outlet />

            <ShortcutsModal />
            
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