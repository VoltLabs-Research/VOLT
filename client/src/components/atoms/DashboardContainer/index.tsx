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

import { HiPlus } from 'react-icons/hi';
import { IoSearchOutline } from 'react-icons/io5';
import { MdKeyboardArrowDown } from 'react-icons/md';
import { IoNotificationsOutline } from "react-icons/io5";
import './DashboardContainer.css';

const DashboardContainer = ({ children, pageName, className = '' }) => {

    return (
        <div className='dashboard-container'>
            {/*}
            <article className='dashboard-header-container'>
                <div className='dashboard-header-left-container'>
                    <h3 className='dashboard-header-title'>{pageName}</h3>
                    <div className='clickable-container'>
                        <i className='clickable-icon-container'>
                            <HiPlus />
                        </i>
                        <span className='clickable-title'>New Folder</span>
                    </div>
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
            </article>
            */}

            <div className={className}>
                {children}
            </div>

            <div className='whitespace-container'></div>
        </div>
    );
};

export default DashboardContainer;