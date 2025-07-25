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

import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { GrHomeOption } from 'react-icons/gr';
import { BsCommand } from 'react-icons/bs';
import { GoTrash } from 'react-icons/go';
import { TbCube3dSphere } from "react-icons/tb";
import { IoSettingsOutline } from "react-icons/io5";
import { TbBook } from 'react-icons/tb';
import { IoIosHelpCircleOutline } from 'react-icons/io';
import { CiChat1 } from 'react-icons/ci';
import SidebarUserAvatar from '@/components/atoms/SidebarUserAvatar';
import SidebarNavigationOption from '@/components/atoms/SidebarNavigationOption';
import AIPromptBox from '@/components/atoms/AIPromptBox';
import Select from '@/components/atoms/Select';
import useTeamStore from '@/stores/team';
import useTrajectoryStore from '@/stores/trajectories';
import './DashboardLayout.css';

const DashboardLayout = () => {
    const teams = useTeamStore((state) => state.teams);
    const selectedTeam = useTeamStore((state) => state.selectedTeam);
    const getUserTeams = useTeamStore((state) => state.getUserTeams);
    const setSelectedTeam = useTeamStore((state) => state.setSelectedTeam);
    const areTeamsLoading = useTeamStore((state) => state.isLoading);

    const trajectories = useTrajectoryStore((state) => state.trajectories);
    const getTrajectories = useTrajectoryStore((state) => state.getTrajectories);

    useEffect(() => {
        if(selectedTeam === null || trajectories.length) return;
        getTrajectories(selectedTeam._id);
    }, [selectedTeam]);   

    useEffect(() => {
        if(teams.length) return;
        getUserTeams();
    }, []);

    const teamOptions = teams.map((team) => ({
        value: team._id,
        title: team.name
    }));

    return (
        <main className='dashboard-main'>
            <section className='sidebar-container'>
                <article className='sidebar-top-container'>
                    <SidebarUserAvatar />

                    <div className='sidebar-team-selection-container'>
                        <Select
                            value={selectedTeam?._id || ''}
                            className='team-select-container'
                            onChange={(teamId) => setSelectedTeam(teamId)}
                            options={teamOptions}
                            disabled={areTeamsLoading || teams.length === 0}
                        />
                    </div>

                    <div className='sidebar-nav-container'>
                        {[
                            ['Dashboard', GrHomeOption, '/dashboard'],
                            ['Team Messages', CiChat1, '/dashboard/simulations'],
                            ['Studio', TbCube3dSphere, ''],
                            ['Tutorials', TbBook, '/dashboard/tutorials'],
                        ].map(([ name, Icon, to ], index) => (
                            <SidebarNavigationOption 
                                key={`${name}-${index}`} 
                                name={name} 
                                to={to}
                                Icon={Icon} 
                                isSelected={index === 0} />
                        ))}
                    </div>
                </article>

                <article className='sidebar-bottom-container'>
                    {[
                        ['Archive', GoTrash],
                        ['Shortcuts', BsCommand],
                        ['Settings', IoSettingsOutline],
                        ['Help & Feedback', IoIosHelpCircleOutline]
                    ].map(([ name, Icon ], index) => (
                        <SidebarNavigationOption key={`${name}-${index}`} name={name} Icon={Icon} />
                    ))}
                </article>
            </section>
                
            <Outlet />

            <AIPromptBox />
        </main>
    );
};

export default DashboardLayout;