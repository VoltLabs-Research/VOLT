/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*/

import React, { useMemo } from 'react';
import './ProgressBorderContainer.css';

interface ProgressBorderContainerProps {
    children: React.ReactNode;
    progressBorder: string;
    animatedProgressBorder?: string; 
    hasJobs: boolean;
    shouldHideBorder: boolean;
    isAnimating?: boolean;
    className?: string;
}

const ProgressBorderContainer: React.FC<ProgressBorderContainerProps> = ({
    children,
    progressBorder,
    animatedProgressBorder,
    hasJobs,
    shouldHideBorder,
    isAnimating = false,
    className = ''
}) => {
    const backgroundImage = useMemo(() => {
        return animatedProgressBorder || progressBorder;
    }, [animatedProgressBorder, progressBorder]);

    const containerClasses = useMemo(() => {
        return [
            'progress-border-container',
            hasJobs && !shouldHideBorder ? 'progress-border-container--active' : '',
            isAnimating ? 'progress-border-container--animating' : '',
            className
        ].filter(Boolean).join(' ');
    }, [hasJobs, shouldHideBorder, isAnimating, className]);

    const containerStyle = useMemo(() => ({
        '--progress-border': backgroundImage
    } as React.CSSProperties), [backgroundImage]);

    return (
        <div 
            className={containerClasses}
            style={containerStyle}
        >
            {children}
        </div>
    );
};

export default React.memo(ProgressBorderContainer);