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
import { TbHexagons } from "react-icons/tb";
import { PiLineSegments } from "react-icons/pi";
import { HiOutlineServerStack } from "react-icons/hi2";
import { FaArrowUpLong } from "react-icons/fa6";
import TinyLineChart from '@/components/atoms/TinyLineChart';
import useTeamJobs from '@/hooks/jobs/use-team-jobs';
import JobsHistoryViewer from '@/components/organisms/JobsHistoryViewer';
import SidebarUserAvatar from '@/components/atoms/auth/SidebarUserAvatar';
import './Dashboard.css';

const pData = [2400, 1398, 9800, 3908, 4800, 3800, 4300];

const DashboardPage: React.FC = memo(() => {
    useTeamJobs();
    const toggleDashboardSidebar = useUIStore((state) => state.toggleDashboardSidebar);

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

                <div className='dashboard-stats-container'>
                    {[{
                        name: 'Structure Analysis',
                        count: '253',
                        lastMonthStatus: 4,
                        Icon: TbHexagons
                    }, {
                        name: 'Trajectories',
                        count: '41',
                        lastMonthStatus: 4,
                        Icon: HiOutlineServerStack       
                    }, {
                        name: 'Dislocations',
                        count: '9.8k',
                        lastMonthStatus: 4,
                        Icon: PiLineSegments  
                    }].map(({ Icon, name, count, lastMonthStatus }, index) => (
                        <div className='dashboard-stat-container' key={index}>
                            <div className='dashboard-stat-left-container'>
                                <div className='dashboard-stat-header-container'>
                                    <i className='dashboard-stat-icon-container'>
                                        <Icon />
                                    </i>
                                    <h3 className='dashboard-stat-title'>{name}</h3>
                                </div>
                                <div className='dashboard-stat-footer-container'>
                                    <h3 className='dashboard-stat-count'>{count}</h3>
                                    <div className='dashboard-stat-last-month-container'>
                                        <div className='dashboard-stat-last-month-icon-container'>
                                            <i className='dashboard-stat-last-month-icon'>
                                                <FaArrowUpLong />
                                            </i>
                                            <span className='dashboard-stat-last-month-helper-text'>{lastMonthStatus}%</span>
                                        </div>
                                        <span className='dashboard-stat-last-month-title'>Last Month</span>
                                    </div>
                                </div>
                            </div>

                            <div className='dashboard-stat-analytic-container'>
                                <TinyLineChart lineColor={'#28b85d'} pData={pData} xLabels={pData} />
                            </div>
                        </div> 
                    ))}
                </div>

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