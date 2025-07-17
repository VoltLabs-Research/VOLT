import React from 'react';
import { BsFiles } from 'react-icons/bs';
import { GoPeople } from 'react-icons/go';
import { TbBook } from 'react-icons/tb';
import { GrHomeOption } from 'react-icons/gr';
import { HiPlus } from 'react-icons/hi';
import { IoIosHelpCircleOutline } from 'react-icons/io';
import { GoTrash } from 'react-icons/go';
import './Dashboard.css';

const DashboardPage = () => {
    return (
        <main className='dashboard-main'>
            <section className='sidebar-container'>
                <article className='sidebar-top-container'>
                    <div className='sidebar-user-container'>
                        <div className='sidebar-user-avatar-container'>
                            <span className='sidebar-user-avatar'>R</span>
                        </div>

                        <span className='sidebar-user-fullname'>Rodolfo Herrera</span>
                    </div>

                    <div className='sidebar-nav-container'>
                        {[
                            ['Dashboard', GrHomeOption],
                            ['Simulations', BsFiles],
                            ['Shared with me', GoPeople],
                            ['Tutorials', TbBook]
                        ].map(([ name, Icon ], index) => (
                            <div
                                className={'sidebar-nav-option-container '.concat(index === 0 ? 'selected' : '')}
                                key={`${name}-${index}`}
                            >
                                <i className='sidebar-nav-option-icon-container'>
                                    <Icon />
                                </i>

                                <h3 className='sidebar-nav-option-name'>{name}</h3>
                            </div>
                        ))}
                    </div>

                    <div className='sidebar-teams-container'>
                        <h3 className='sidebar-teams-title'>Teams</h3>
                        <div className='sidebar-new-team-container'>
                            <i className='sidebar-new-team-icon-container'>
                                <HiPlus />
                            </i>

                            <span className='sidebar-new-team-title'>Create new team</span>
                        </div>
                    </div>
                </article>

                <article className='sidebar-bottom-container'>
                    {[
                        ['Archive', GoTrash],
                        ['Help & Feedback', IoIosHelpCircleOutline]
                    ].map(([ name, Icon ], index) => (
                        <div
                            className={'sidebar-nav-option-container'}
                            key={`${name}-${index}`}
                        >
                            <i className='sidebar-nav-option-icon-container'>
                                <Icon />
                            </i>

                            <h3 className='sidebar-nav-option-name'>{name}</h3>
                        </div>
                    ))}
                </article>
            </section>
        </main>
    );
};

export default DashboardPage;