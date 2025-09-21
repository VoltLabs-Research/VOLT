import React, { useState, useRef, useCallback, useEffect, memo } from 'react';
import { MdOutlineSchedule } from "react-icons/md";
import { RiCloseLargeFill } from 'react-icons/ri';
import JobsHistory from '@/components/molecules/JobsHistory';
// Double-tap / resize / move removed for a simpler, minimal experience

const JobsHistoryViewer: React.FC = memo(() => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const headerRef = useRef<HTMLDivElement>(null);
    const bodyRef = useRef<HTMLDivElement>(null);

    const toggleBodyScroll = useCallback((lock: boolean) => {
        document.body.classList.toggle('jobs-history-expanded', lock);
    }, []);

    const handleToggle = useCallback(() => {
        if(isAnimating) return;
        const nextIsExpanded = !isExpanded;
        setIsAnimating(true);
        toggleBodyScroll(nextIsExpanded);
        setIsExpanded(nextIsExpanded);

        setTimeout(() => {
            setIsAnimating(false);
        }, 500);
    }, [isAnimating, isExpanded, toggleBodyScroll]);

    useEffect(() => {
        if(!isExpanded) return;

        const handleClickOutside = (event: MouseEvent) => {
            if(containerRef.current && !containerRef.current.contains(event.target as Node)){
                // no-op, just keep panel expanded until user closes
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isExpanded]);

    const containerClasses = [
        'jobs-history-viewer-enhanced',
        isExpanded && 'expanded',
    ].filter(Boolean).join(' ');

    const headerClasses = 'jobs-history-viewer-header-enhanced';

    const getSubtitle = () => 'Recent team activity';
    
    const dynamicStyles: React.CSSProperties = {};

    return (
        <>
            <div 
                ref={containerRef} 
                className={containerClasses} 
                onClick={!isExpanded && !isAnimating ? handleToggle : undefined} 
                style={dynamicStyles}
            >
                <div className='jobs-history-dispatch-container-enhanced'>
                    <div className='jobs-history-dispatch-icon-container-enhanced'><MdOutlineSchedule /></div>
                    <div className='jobs-dispatch-text'>
                        <h3 className='jobs-history-dispatch-title-enhanced'>Team Activity</h3>
                        <span className='jobs-dispatch-subtitle'>Tap to view</span>
                    </div>
                </div>
                <div className='jobs-history-expanded-content'>
                    <div 
                        ref={headerRef} 
                        className={headerClasses}
                        style={{ touchAction: 'none' }}
                    >
                        <div className='header-content'>
                            <h3 className='jobs-history-title-enhanced'>Jobs History</h3>
                            <span className='jobs-history-subtitle'>{getSubtitle()}</span>
                        </div>
                        <button 
                            className='close-button-enhanced' 
                            onClick={(e) => { e.stopPropagation(); handleToggle(); }} 
                            disabled={isAnimating}>
                                <RiCloseLargeFill />
                        </button>
                    </div>
                    <div 
                        ref={bodyRef}
                        className='jobs-history-viewer-body-enhanced'
                    >
                        <JobsHistory />
                    </div>
                </div>
            </div>
        </>
    );
});

JobsHistoryViewer.displayName = 'JobsHistoryViewerMobile';

export default JobsHistoryViewer;