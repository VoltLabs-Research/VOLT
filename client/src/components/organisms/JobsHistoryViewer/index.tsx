import React, { useState, useRef, useCallback, useEffect, memo } from 'react';
import { MdOutlineSchedule } from "react-icons/md";
import { RiCloseLargeFill } from 'react-icons/ri';
import JobsHistory from '@/components/molecules/JobsHistory';
import useIsMobile from '@/hooks/ui/use-is-mobile';
import useResizable from '@/hooks/ui/use-resizable';
import useDraggable from '@/hooks/ui/use-draggable';
import useDoubleTap from '@/hooks/ui/use-double-tap';

type EditMode = 'inactive' | 'resize' | 'move';

const JobsHistoryViewerMobile: React.FC = memo(() => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);
    const [editMode, setEditMode] = useState<EditMode>('inactive');

    const containerRef = useRef<HTMLDivElement>(null);
    const headerRef = useRef<HTMLDivElement>(null);
    const bodyRef = useRef<HTMLDivElement>(null);

    const { size, isResizing, resetSize } = useResizable({
        elementRef: containerRef,
        handleRef: headerRef,
        initialSize: { width: 90, height: 85 },
        isEnabled: editMode === 'resize'
    });

    const { position, isDragging, resetPosition } = useDraggable({
        elementRef: containerRef,
        handleRef: headerRef,
        isEnabled: editMode === 'move'
    });

    const headerDoubleTap = useDoubleTap({ onDoubleTap: () => setEditMode('resize') });
    const bodyDoubleTap = useDoubleTap({ onDoubleTap: () => setEditMode('move') });

    const isInteracting = isResizing || isDragging;

    const toggleBodyScroll = useCallback((lock: boolean) => {
        document.body.classList.toggle('jobs-history-expanded', lock);
    }, []);

    const handleToggle = useCallback(() => {
        if(isAnimating || isInteracting) return;
        const nextIsExpanded = !isExpanded;
        setIsAnimating(true);
        toggleBodyScroll(nextIsExpanded);
        setIsExpanded(nextIsExpanded);

        if(!nextIsExpanded){
            setEditMode('inactive');
            resetSize();
            resetPosition();
        }

        setTimeout(() => {
            setIsAnimating(false);
        }, 500);
    }, [isAnimating, isInteracting, isExpanded, resetSize, resetPosition, toggleBodyScroll]);

    useEffect(() => {
        if(!isExpanded || editMode === 'inactive') return;

        const handleClickOutside = (event: MouseEvent) => {
            if(containerRef.current && !containerRef.current.contains(event.target as Node)){
                setEditMode('inactive');
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isExpanded, editMode]);

    const containerClasses = [
        'jobs-history-viewer-enhanced',
        isExpanded && 'expanded',
        isInteracting && 'is-interacting',
    ].filter(Boolean).join(' ');

    const headerClasses = [
        'jobs-history-viewer-header-enhanced',
        editMode === 'resize' && 'edit-mode-resize',
        editMode === 'move' && 'edit-mode-move',
    ].filter(Boolean).join(' ');

    const getSubtitle = () => {
        if(editMode === 'resize') return 'Drag the header to resize';
        if(editMode === 'move') return 'Drag the header to move';
        return 'Double-tap on header (resize) or body (move)';
    };
    
    const dynamicStyles: React.CSSProperties = isExpanded ? { 
        width: `${size.width}vw`, 
        height: `${size.height}vh`,
        transform: `translate(${position.x}px, ${position.y}px)`,
    } : {};

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
                        <h3 className='jobs-history-dispatch-title-enhanced'>Team Jobs</h3>
                        <span className='jobs-dispatch-subtitle'>Tap to view</span>
                    </div>
                    <div className="glow-effect"></div>
                </div>
                <div className='jobs-history-expanded-content'>
                    <div 
                        ref={headerRef} 
                        className={headerClasses}
                        style={{ touchAction: 'none' }}
                        onMouseDown={headerDoubleTap.onMouseDown}
                    >
                        <div className='header-content'>
                            <h3 className='jobs-history-title-enhanced'>Jobs History</h3>
                            <span className='jobs-history-subtitle'>{getSubtitle()}</span>
                        </div>
                        <button 
                            className='close-button-enhanced' 
                            onClick={(e) => { e.stopPropagation(); handleToggle(); }} 
                            disabled={isAnimating || isInteracting}>
                                <RiCloseLargeFill />
                        </button>
                    </div>
                    <div 
                        ref={bodyRef}
                        className='jobs-history-viewer-body-enhanced'
                        onMouseDown={bodyDoubleTap.onMouseDown}
                    >
                        <JobsHistory />
                    </div>
                </div>
            </div>
        </>
    );
});

JobsHistoryViewerMobile.displayName = 'JobsHistoryViewerMobile';

const JobsHistoryViewerDesktop: React.FC = memo(() => (
    <div className='jobs-history-viewer-desktop'>
        <div className='jobs-history-viewer-header-desktop'>
            <h3 className='jobs-history-title-enhanced'>Team Jobs History</h3>
            <span className='jobs-history-subtitle'>Review of recent jobs</span>
        </div>
        <div className='jobs-history-viewer-body-desktop'>
            <JobsHistory />
        </div>
    </div>
));

JobsHistoryViewerDesktop.displayName = 'JobsHistoryViewerDesktop';

const JobsHistoryViewer: React.FC = memo(() => {
    const isMobile = useIsMobile();
    return isMobile ? <JobsHistoryViewerMobile /> : <JobsHistoryViewerDesktop />;
});

JobsHistoryViewer.displayName = 'JobsHistoryViewer';

export default JobsHistoryViewer;