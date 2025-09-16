import React, { useEffect, useRef } from 'react';
import type { ThumbnailsProps } from '@/types/raster';
import ThumbnailSkeleton from '@/components/atoms/raster/ThumbnailSkeleton';
import ThumbnailItem from '@/components/atoms/raster/ThumbnailItem';

const Thumbnails: React.FC<ThumbnailsProps> = ({
    timeline,
    selectedFrameIndex,
    isPlaying,
    isLoading,
    onThumbnailClick,
    getThumbnailScene
}) => {
    const thumbnailsRef = useRef<HTMLDivElement>(null);
    const thumbnailItemsRef = useRef<(HTMLDivElement | null)[]>([]);

    const smoothScrollIntoView = (container: HTMLElement, target: HTMLElement): void => {
        const start = container.scrollLeft;
        const targetLeft = target.offsetLeft - container.clientWidth / 2 + target.clientWidth / 2;
        const distance = targetLeft - start;
        const startTime = performance.now();

        const easeOutQuart = (t: number): number => {
            return 1 - Math.pow(1 - t, 4);
        };

        const animateScroll = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / 800, 1);
            const easedProgress = easeOutQuart(progress);
            
            container.scrollLeft = start + distance * easedProgress;
            if(progress < 1) requestAnimationFrame(animateScroll);
        };

        requestAnimationFrame(animateScroll);
    };

    useEffect(() => {
        const container = thumbnailsRef.current;
        const target = thumbnailItemsRef.current[selectedFrameIndex];

        if(container && target){
            smoothScrollIntoView(container, target);
        }
    }, [selectedFrameIndex]);

    return (
        <div className='raster-thumbnails' ref={thumbnailsRef} style={{ paddingBlock: '.25rem' }}>
            {isLoading || timeline.length === 0 ? (
                Array.from({ length: 8 }, (_, i) => <ThumbnailSkeleton key={`thumb-skel-${i}`} />)
            ) : (
                timeline.map((timestep, index) => {
                    const scene = getThumbnailScene(timestep);
                    if(!scene) return null;

                    const isActive = index === selectedFrameIndex;

                    return (
                        <div 
                            key={`thumb-${timestep}-${scene.model}`} 
                            ref={el => thumbnailItemsRef.current[index] = el}
                        >
                            <ThumbnailItem
                                scene={scene}
                                timestep={timestep}
                                index={index}
                                isActive={isActive}
                                isPlaying={isPlaying}
                                selectedFrameIndex={selectedFrameIndex}
                                onClick={onThumbnailClick}
                            />
                        </div> 
                    );
                })
            )}
        </div>
    );
};

export default Thumbnails;