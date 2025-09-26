import React from 'react';
import './WindowIcons.css';

const WindowIcons: React.FC = () => {
    const icons = [{
        variant: 'close'
    }, {
        variant: 'minimize'
    }, {
        variant: 'expand'
    }];

    return (
        <div className='window-icons-container'>
            {icons.map((icon, index) => (
                <div className={'window-icon-circle ' + icon.variant} key={index}>

                </div>
            ))}
        </div>
    );
};

export default WindowIcons;