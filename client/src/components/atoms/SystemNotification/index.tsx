import React from 'react';
import './SystemNotification.css';

const SystemNotification = () => {
    return (
        <div className='system-notification-container'>
            <p className='system-notification-content'>You don't have permission to perform this action. CPU-intensive tasks have been disabled. Please try again later or contact your cluster administrator.</p>
            <div className='system-notification-footer-container'>
                <button className='system-notification-btn'>Accept</button>
            </div>
        </div>   
    );
};

export default SystemNotification;