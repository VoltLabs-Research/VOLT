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

import { Outlet } from 'react-router-dom';
import { GrHomeOption } from 'react-icons/gr';
import { BsFiles } from 'react-icons/bs';
import { GoPeople, GoTrash } from 'react-icons/go';
import { TbBook } from 'react-icons/tb';
import { IoIosHelpCircleOutline } from 'react-icons/io';
import SidebarUserAvatar from '@/components/atoms/SidebarUserAvatar';
import SidebarNavigationOption from '@/components/atoms/SidebarNavigationOption';
import SidebarTeams from '@/components/atoms/SidebarTeams';
import AIPromptBox from '@/components/atoms/AIPromptBox';
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