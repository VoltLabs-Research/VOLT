import React from 'react';
import { BsFiles } from 'react-icons/bs';
import { GoPeople } from 'react-icons/go';
import { TbBook } from 'react-icons/tb';
import { GrHomeOption } from 'react-icons/gr';
import { HiPlus } from 'react-icons/hi';
import { IoIosHelpCircleOutline } from 'react-icons/io';
import { GoTrash } from 'react-icons/go';
import { PiDotsThreeVerticalBold } from "react-icons/pi";
import { MdKeyboardArrowDown } from "react-icons/md";
import { IoSearchOutline } from "react-icons/io5";
import { HiArrowUp } from "react-icons/hi";
import SimpExampleCover from '../../../assets/images/simulation-example-cover.png'
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

            <section className='dashboard-container'>
                <article className='dashboard-header-container'>
                    <div className='dashboard-header-left-container'>
                        <h3 className='dashboard-header-title'>Dashboard</h3>
                        <div className='clickable-container'>
                            <i className='clickable-icon-container'>
                                <HiPlus />
                            </i>
                            <span className='clickable-title'>New Folder</span>
                        </div>
                    </div>

                    <div className='dashboard-header-right-container'>
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
                </article>

                <figure className='simulation-container'>
                    <img className='simulation-image' src={SimpExampleCover} />
                    <figcaption className='simulation-caption-container'>
                        <div className='simulation-caption-left-container'>
                            <h3 className='simulation-caption-title'>FCC Test Simulation</h3>
                            <p className='simulation-last-edited'>Edited 6 hours ago</p>
                        </div>
                        <i className='simulation-options-icon-container'>
                            <PiDotsThreeVerticalBold />
                        </i>
                    </figcaption>
                </figure>
            </section>

            <div className='ai-prompt-container-wrapper'>
                <div className='ai-prompt-add-file-container'>
                    <i className='ai-prompt-add-file-icon-container'>
                        <HiPlus />
                    </i>
                    <span className='ai-prompt-add-file-title'>Add files</span>
                </div>
                <div className='ai-prompt-container'>
                    <input className='ai-prompt-input' placeholder="I'm here to help you, ask me for anything." />
                    <i className='ai-prompt-icon-container'>
                        <HiArrowUp />
                    </i>
                </div>
            </div>
        </main>
    );
};

export default DashboardPage;