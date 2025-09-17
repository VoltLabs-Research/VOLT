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

    // Efecto para asegurar que el frame seleccionado se cargue primero
    useEffect(() => {
        if (selectedFrameIndex >= 0 && selectedFrameIndex < timeline.length) {
            // Intentar precargar el frame seleccionado inmediatamente
            const timestep = timeline[selectedFrameIndex];
            const scene = getThumbnailScene(timestep);
            
            if (scene) {
                console.log(`[Thumbnails] Selected frame changed to index ${selectedFrameIndex}, timestep ${timestep}`);
            }
        }
    }, [selectedFrameIndex, timeline, getThumbnailScene]);

    // Efecto para hacer scroll al frame seleccionado
    useEffect(() => {
        const container = thumbnailsRef.current;
        const target = thumbnailItemsRef.current[selectedFrameIndex];

        if(container && target){
            smoothScrollIntoView(container, target);
        }
    }, [selectedFrameIndex]);

    // Mostrar esqueletos solo si no hay timeline o estamos en la carga inicial
    const shouldShowSkeletons = isLoading && (timeline.length === 0);

    return (
        <div className='raster-thumbnails' ref={thumbnailsRef} style={{ paddingBlock: '.25rem' }}>
            {shouldShowSkeletons ? (
                // Solo mostrar esqueletos cuando estamos cargando inicialmente y no hay timeline
                Array.from({ length: 8 }, (_, i) => <ThumbnailSkeleton key={`thumb-skel-${i}`} />)
            ) : (
                timeline.map((timestep, index) => {
                    const scene = getThumbnailScene(timestep);
                    if(!scene) return null;

                    const isActive = index === selectedFrameIndex;

                    // Renderizar el thumbnail activo primero para darle prioridad
                    return (
                        <div 
                            key={`thumb-${timestep}-${scene.model}`} 
                            ref={el => {
                                thumbnailItemsRef.current[index] = el;
                                return undefined;
                            }}
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

export default React.memo(Thumbnails);