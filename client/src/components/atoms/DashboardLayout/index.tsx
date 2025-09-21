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
import { Outlet, useNavigate } from 'react-router-dom';
import { TbCube3dSphere } from "react-icons/tb";
import { IoSearchOutline, IoSettingsOutline } from "react-icons/io5";
import { TbBook } from 'react-icons/tb';
import { RiHomeSmile2Fill } from "react-icons/ri";
import { IoNotificationsOutline } from "react-icons/io5";
import { CiChat1 } from 'react-icons/ci';
import SidebarUserAvatar from '@/components/atoms/auth/SidebarUserAvatar';
import useTeamStore from '@/stores/team/team';
import useTrajectoryStore from '@/stores/trajectories';
import ShortcutsModal from '@/components/organisms/ShortcutsModal';
import useNotificationStore from '@/stores/notifications';
import './DashboardLayout.css';
import type { IconType } from 'react-icons';

const DashboardLayout = () => {
    const teams = useTeamStore((state) => state.teams);
    const selectedTeam = useTeamStore((state) => state.selectedTeam);
    const getUserTeams = useTeamStore((state) => state.getUserTeams);
    const navigate = useNavigate();

    const trajectories = useTrajectoryStore((state) => state.trajectories);
    const getTrajectories = useTrajectoryStore((state) => state.getTrajectories);
    const { notifications, fetch, markAsRead } = useNotificationStore();
    const [notifOpen, setNotifOpen] = useState(false);
    const bellWrapperRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if(selectedTeam === null || trajectories.length) return;
        getTrajectories(selectedTeam._id);
    }, [selectedTeam]);   

    useEffect(() => {
        if(teams.length) return;
        getUserTeams();
    }, []);

    useEffect(() => {
        if(!notifOpen) return;
        fetch({ force: true });
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

    const notificationList = useMemo(() => notifications, [notifications]);
    const navItems: Array<[string, IconType, string]> = useMemo(() => ([
        ['Dashboard', RiHomeSmile2Fill, '/dashboard'],
        ['Messages', CiChat1, '/dashboard/messages'],
        ['Studio', TbCube3dSphere, ''],
        ['Tutorials', TbBook, '/dashboard/tutorials']
    ]), []);

    return (
        <main className='dashboard-main'>
            <section className='dashboard-layout-header-container'>
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
                        <input placeholder='Search' className='search-input '/>
                    </div>
                </div>

                <div className='dashboard-user-container'>
                    <div className='badge-container as-icon-container over-light-bg'>
                        <IoSettingsOutline />
                    </div>

                    <div ref={bellWrapperRef} className='dashboard-bell-wrapper'>
                        <div onClick={() => setNotifOpen((v) => !v)} className='badge-container as-icon-container over-light-bg dashboard-bell-trigger'>
                            <IoNotificationsOutline />
                        </div>
                        {notifOpen && (
                            <div className='dashboard-notifications-dropdown'>
                                <div className='dashboard-notifications-header'>
                                    <span>Notifications</span>
                                    <button className='dashboard-notifications-close' onClick={(e) => { e.stopPropagation(); setNotifOpen(false); }}>×</button>
                                </div>
                                <div className='dashboard-notifications-body'>
                                    {notificationList.length === 0 && (
                                        <div className='dashboard-notifications-empty'>No notifications</div>
                                    )}
                                    {notificationList.map((n) => (
                                        <div key={n._id} className={`dashboard-notification-item ${n.read ? 'is-read' : ''}`} onClick={() => { if(!n.read) markAsRead(n._id); if(n.link) navigate(n.link); setNotifOpen(false); }}>
                                            <div className='dashboard-notification-title'>{n.title}</div>
                                            <div className='dashboard-notification-content'>{n.content}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <SidebarUserAvatar avatarrounded />
                </div>
            </section>
                
            <Outlet />

            <ShortcutsModal />
        </main>
    );
};

export default DashboardLayout;