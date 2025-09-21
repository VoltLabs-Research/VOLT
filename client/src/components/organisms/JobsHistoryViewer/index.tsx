import React, { useRef, memo } from 'react';
import JobsHistory from '@/components/molecules/JobsHistory';
// Double-tap / resize / move removed for a simpler, minimal experience

const JobsHistoryViewer: React.FC = memo(() => {
    const containerRef = useRef<HTMLDivElement>(null);
    const headerRef = useRef<HTMLDivElement>(null);
    const bodyRef = useRef<HTMLDivElement>(null);

    // Always expanded
    const containerClasses = 'jobs-history-viewer-enhanced expanded';
    const headerClasses = 'jobs-history-viewer-header-enhanced';

    const dynamicStyles: React.CSSProperties = {};

    return (
        <>
            <div 
                ref={containerRef} 
                className={containerClasses} 
                style={dynamicStyles}
            >
                <div className='jobs-history-expanded-content'>
                    <div 
                        ref={headerRef} 
                        className={headerClasses}
                        style={{ touchAction: 'none' }}
                    >
                        <div className='header-content'>
                            <h3 className='jobs-history-title-enhanced'>Recent Team Activity</h3>
                            <span className='jobs-history-subtitle'>The listed processes are queued and executed given the cluster load.</span>
                        </div>
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