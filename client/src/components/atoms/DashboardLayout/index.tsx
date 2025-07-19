import { Outlet } from 'react-router-dom';
import { GrHomeOption } from 'react-icons/gr';
import { BsFiles } from 'react-icons/bs';
import { GoPeople, GoTrash } from 'react-icons/go';
import { TbBook } from 'react-icons/tb';
import { IoIosHelpCircleOutline } from 'react-icons/io';
import SidebarUserAvatar from '../SidebarUserAvatar';
import SidebarNavigationOption from '../SidebarNavigationOption';
import SidebarTeams from '../SidebarTeams';
import AIPromptBox from '../AIPromptBox';
import './DashboardLayout.css';

const DashboardLayout = () => {
    return (
        <main className='dashboard-main'>
            <section className='sidebar-container'>
                <article className='sidebar-top-container'>
                    <SidebarUserAvatar />

                    <div className='sidebar-nav-container'>
                        {[
                            ['Dashboard', GrHomeOption, '/dashboard'],
                            ['Simulations', BsFiles, '/dashboard/simulations'],
                            ['Shared with me', GoPeople, '/dashboard/shared-with-me'],
                            ['Tutorials', TbBook, '/dashboard/tutorials']
                        ].map(([ name, Icon, to ], index) => (
                            <SidebarNavigationOption 
                                key={`${name}-${index}`} 
                                name={name} 
                                to={to}
                                Icon={Icon} 
                                isSelected={index === 0} />
                        ))}
                    </div>
                    

                    <SidebarTeams />
                </article>

                <article className='sidebar-bottom-container'>
                    {[
                        ['Archive', GoTrash],
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