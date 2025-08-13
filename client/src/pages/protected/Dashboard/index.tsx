import React, { memo } from 'react';
import DashboardContainer from '@/components/atoms/DashboardContainer';
import SimulationGrid from '@/components/molecules/SimulationGrid';
import FileUpload from '@/components/molecules/FileUpload';
import TrajectoryPreview from '@/components/molecules/TrajectoryPreview';
import useUIStore from '@/stores/ui';
import { HiPlus } from 'react-icons/hi';
import { IoSearchOutline } from 'react-icons/io5';
import { MdKeyboardArrowDown } from 'react-icons/md';
import { IoNotificationsOutline } from "react-icons/io5";
import useTeamJobs from '@/hooks/jobs/use-team-jobs';
import JobsHistoryViewer from '@/components/organisms/JobsHistoryViewer';
import SidebarUserAvatar from '@/components/atoms/auth/SidebarUserAvatar';
import DashboardStats from '@/components/atoms/DashboardStats';
import useTeamStore from '@/stores/team';
import './Dashboard.css';

const DashboardPage: React.FC = memo(() => {
    useTeamJobs();
    const toggleDashboardSidebar = useUIStore((state) => state.toggleDashboardSidebar);
    const teamId = useTeamStore((state) => state.selectedTeam?._id);

    return (
        <FileUpload>            
            <DashboardContainer pageName='Dashboard' className='dashboard-wrapper-container'>
                <article className='dashboard-header-container'>
                    <div className='dashboard-header-left-container'>
                        <h3 className='dashboard-header-title'>Dashboard</h3>
                    </div>

                    <div className='dashboard-header-right-container'>
                        <div className='dashboard-clickables-container'>
                            {[IoNotificationsOutline].map((Icon, index) => (
                                <div className='dashboard-clickable-container' key={index}>
                                    <Icon />
                                </div>
                            ))}
                        </div>

                        <div className='search-container'>
                            <i className='search-icon-container'>
                                <IoSearchOutline />
                            </i>
                            <input placeholder='Search' className='search-input '/>
                        </div>

                        <div className='create-new-button-container'>
                            <i className='create-new-button-icon-container'>
                                <HiPlus />
                            </i>
                            <span className='create-new-button-title'>Create</span>
                            <i className='create-new-button-dropdown-icon-container'>
                                <MdKeyboardArrowDown />
                            </i>
                        </div>                    
                    </div>

                    <div className='dashboard-header-right-mobile-container'>
                        <div className='dashboard-clickables-container'>
                            {[IoNotificationsOutline].map((Icon, index) => (
                                <div className='dashboard-clickable-container' key={index}>
                                    <Icon />
                                </div>
                            ))}
                        </div>

                        <SidebarUserAvatar
                            onClick={toggleDashboardSidebar}
                            hideUsername={true}
                        />
                    </div>
                </article>

                <DashboardStats teamId={teamId} />

                <div className='dashboard-main-container'>
                    <TrajectoryPreview />
                    <JobsHistoryViewer />
                </div>
                
                <SimulationGrid />
            </DashboardContainer>

            {/* <AIPromptBox /> */}
        </FileUpload>
    );
});

DashboardPage.displayName = 'DashboardPage';

export default DashboardPage;