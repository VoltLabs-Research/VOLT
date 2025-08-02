import React from 'react';

const ProgressBorderContainer: React.FC<any> = ({ 
    children, 
    progressBorder, 
    hasJobs, 
    shouldHideBorder,
    borderRadius = '16px',
    innerBorderRadius = '12px'
}) => {
    return (
        <div 
            className='progress-border-wrapper'
            style={{
                background: progressBorder,
                padding: (hasJobs && !shouldHideBorder) ? '4px' : '0px',
                borderRadius,
                transition: 'all 0.5s ease'
            }}
        >
            <div 
                style={{
                    borderRadius: innerBorderRadius,
                    overflow: 'hidden'
                }}
            >
                {children}
            </div>
        </div>
    );
};

export default ProgressBorderContainer;