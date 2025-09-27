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
import { 
    IoSearchOutline, 
    IoCallOutline, 
    IoVideocamOutline, 
    IoInformationCircleOutline,
    IoEllipsisVerticalOutline,
    IoPaperPlaneOutline,
    IoAttachOutline,
    IoHappyOutline,
    IoEllipsisHorizontalOutline
} from 'react-icons/io5';
import './Messages.css';

const MessagesPage = () => {
    // Sample conversations data
    const conversations = [
        {
            id: 1,
            name: 'Dr. Sarah Chen',
            avatar: 'SC',
            lastMessage: 'The simulation results look promising. We should discuss the next steps.',
            time: '2m ago',
            unread: 2,
            isOnline: true
        },
        {
            id: 2,
            name: 'Research Team',
            avatar: 'RT',
            lastMessage: 'Meeting scheduled for tomorrow at 2 PM',
            time: '1h ago',
            unread: 0,
            isOnline: false
        },
        {
            id: 3,
            name: 'Prof. Michael Rodriguez',
            avatar: 'MR',
            lastMessage: 'Thanks for sharing the analysis. Very insightful!',
            time: '3h ago',
            unread: 0,
            isOnline: true
        },
        {
            id: 4,
            name: 'Lab Assistant',
            avatar: 'LA',
            lastMessage: 'The new dataset is ready for processing',
            time: '5h ago',
            unread: 1,
            isOnline: false
        }
    ];

    // Sample messages data
    const messages = [
        {
            id: 1,
            text: 'Hi Sarah! I wanted to discuss the simulation results from yesterday.',
            time: '10:30 AM',
            isSent: false,
            avatar: 'SC'
        },
        {
            id: 2,
            text: 'Hello! Yes, I\'ve been reviewing them. The dislocation analysis shows some interesting patterns.',
            time: '10:32 AM',
            isSent: true,
            avatar: 'You'
        },
        {
            id: 3,
            text: 'Absolutely! The grain boundary interactions are particularly fascinating. We should run additional simulations to confirm our hypothesis.',
            time: '10:35 AM',
            isSent: false,
            avatar: 'SC'
        },
        {
            id: 4,
            text: 'I agree. I can prepare the input files for the extended simulation. Should we schedule a meeting to discuss the parameters?',
            time: '10:37 AM',
            isSent: true,
            avatar: 'You'
        }
    ];

    return (
        <DashboardContainer pageName='Messages' className='chat-main-container'>
            {/* Sidebar */}
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

                <div className='chat-conversations-container'>
                    {conversations.map((conversation) => (
                        <div key={conversation.id} className={`chat-conversation-item ${conversation.id === 1 ? 'active' : ''}`}>
                            <div className='chat-conversation-avatar'>
                                {conversation.avatar}
                            </div>
                            <div className='chat-conversation-content'>
                                <div className='chat-conversation-header'>
                                    <h4 className='chat-conversation-name'>{conversation.name}</h4>
                                    <span className='chat-conversation-time'>{conversation.time}</span>
                                </div>
                                <p className='chat-conversation-preview'>{conversation.lastMessage}</p>
                            </div>
                            {conversation.unread > 0 && (
                                <div className='chat-conversation-badge'>
                                    {conversation.unread}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Chat Area */}
            <div className='chat-messages-container'>
                <div className='chat-box-container'>
                    {/* Chat Header */}
                    <div className='chat-box-header-container'>
                        <div className='chat-header-user'>
                            <div className='chat-header-avatar'>SC</div>
                            <div className='chat-header-info'>
                                <h3 className='chat-header-name'>Dr. Sarah Chen</h3>
                                <div className='chat-header-status'>Online</div>
                            </div>
                        </div>
                        <div className='chat-header-actions'>
                            <button className='chat-header-action' title='Call'>
                                <IoCallOutline />
                            </button>
                            <button className='chat-header-action' title='Video Call'>
                                <IoVideocamOutline />
                            </button>
                            <button className='chat-header-action' title='More Options'>
                                <IoEllipsisVerticalOutline />
                            </button>
                        </div>
                    </div>

                    {/* Messages Area */}
                    <div className='chat-box-messages-container'>
                        {messages.map((message) => (
                            <div key={message.id} className={`chat-message ${message.isSent ? 'sent' : 'received'}`}>
                                <div className='chat-message-avatar'>
                                    {message.avatar}
                                </div>
                                <div className='chat-message-content'>
                                    <p className='chat-message-text'>{message.text}</p>
                                    <div className='chat-message-time'>{message.time}</div>
                                </div>
                            </div>
                        ))}
                        
                        {/* Typing Indicator */}
                        <div className='chat-message received'>
                            <div className='chat-message-avatar'>SC</div>
                            <div className='chat-typing-indicator'>
                                <div className='chat-typing-dots'>
                                    <div className='chat-typing-dot'></div>
                                    <div className='chat-typing-dot'></div>
                                    <div className='chat-typing-dot'></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Message Input */}
                    <div className='chat-input-container'>
                        <div className='chat-input-wrapper'>
                            <button className='chat-header-action' title='Attach File'>
                                <IoAttachOutline />
                            </button>
                            <textarea 
                                className='chat-input'
                                placeholder='Type a message...'
                                rows={1}
                            />
                            <button className='chat-header-action' title='Emoji'>
                                <IoHappyOutline />
                            </button>
                            <button className='chat-send-button' title='Send Message'>
                                <IoPaperPlaneOutline />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Details Panel */}
                <div className='chat-details-container'>
                    <div className='chat-details-header'>
                        <h3 className='chat-details-title'>Contact Info</h3>
                    </div>
                    
                    <div className='chat-details-content'>
                        <div className='chat-details-section'>
                            <div className='chat-details-user-info'>
                                <div className='chat-details-avatar'>SC</div>
                                <h4 className='chat-details-name'>Dr. Sarah Chen</h4>
                                <div className='chat-details-status'>Online</div>
                            </div>
                        </div>

                        <div className='chat-details-section'>
                            <h4 className='chat-details-section-title'>Actions</h4>
                            <div className='chat-details-actions'>
                                <button className='chat-details-action'>
                                    <i className='chat-details-action-icon'>
                                        <IoCallOutline />
                                    </i>
                                    <span className='chat-details-action-text'>Voice Call</span>
                                </button>
                                <button className='chat-details-action'>
                                    <i className='chat-details-action-icon'>
                                        <IoVideocamOutline />
                                    </i>
                                    <span className='chat-details-action-text'>Video Call</span>
                                </button>
                                <button className='chat-details-action'>
                                    <i className='chat-details-action-icon'>
                                        <IoInformationCircleOutline />
                                    </i>
                                    <span className='chat-details-action-text'>View Profile</span>
                                </button>
                            </div>
                        </div>

                        <div className='chat-details-section'>
                            <h4 className='chat-details-section-title'>Shared Files</h4>
                            <div className='chat-empty-state'>
                                <div className='chat-empty-description'>
                                    No shared files yet
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardContainer>
    )
};

export default MessagesPage;