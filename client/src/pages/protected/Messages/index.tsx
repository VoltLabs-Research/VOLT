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

import DashboardContainer from '@/components/atoms/DashboardContainer';
import { IoSearchOutline } from 'react-icons/io5';
import './Messages.css';

const MessagesPage = () => {

    return (
        <DashboardContainer pageName='Messages' className='chat-main-container'>
            <div className='chat-sidebar-container'>
                <div className='chat-sidebar-header-container'>
                    <h3 className='chat-sidebar-header-title'>Chat</h3>
                    <div className='chat-sidebar-search-container'>
                        <i className='chat-sidebar-search-icon-container'>
                            <IoSearchOutline />
                        </i>
                        <input 
                            placeholder='Search people or messages...'
                            className='chat-sidebar-search-input' />
                    </div>
                </div>
            </div>

            <div className='chat-messages-container'>
                <div className='chat-box-container'>
                    <div className='chat-box-header-container'>
                        
                    </div>

                    <div className='chat-box-messages-container'>

                    </div>
                </div>

                <div className='chat-details-container'>

                </div>
            </div>
        </DashboardContainer>
    )
};

export default MessagesPage;