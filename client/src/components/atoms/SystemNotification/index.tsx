import React from 'react';
import { createPortal } from 'react-dom';
import './SystemNotification.css';

const SystemNotification = () => {
    const rootElement = document.getElementById('root');
    if (!rootElement) {
        return null;
    }
    
    return createPortal(
        <div className='system-notification-container'>
            <p className='system-notification-content'>You don't have permission to perform this action. CPU-intensive tasks have been disabled. Please try again later or contact your cluster administrator.</p>
            <div className='system-notification-footer-container'>
                <button className='system-notification-btn'>Accept</button>
            </div>
        </div>,
        rootElement
    );
};

export default SystemNotification;