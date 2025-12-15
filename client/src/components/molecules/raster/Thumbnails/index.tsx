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
  getThumbnailScene,
}) => {
  const thumbnailsRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<(HTMLDivElement | null)[]>([]);

  const smoothScrollIntoView = (container: HTMLElement, target: HTMLElement): void => {
    const start = container.scrollLeft;
    const targetLeft = target.offsetLeft - container.clientWidth / 2 + target.clientWidth / 2;
    const dist = targetLeft - start;
    const startTime = performance.now();
    const ease = (t: number) => 1 - Math.pow(1 - t, 4);

    const step = (t: number) => {
      const p = Math.min((t - startTime) / 800, 1);
      container.scrollLeft = start + dist * ease(p);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  // Pre-tickle current frame so it loads ASAP
  useEffect(() => {
    if (selectedFrameIndex >= 0 && selectedFrameIndex < timeline.length) {
      const ts = timeline[selectedFrameIndex];
      getThumbnailScene(ts); // returns descriptor; store/hook handles actual fetch
    }
  }, [selectedFrameIndex, timeline, getThumbnailScene]);

  // Scroll active into view
  useEffect(() => {
    const c = thumbnailsRef.current;
    const t = itemsRef.current[selectedFrameIndex];
    if (c && t) smoothScrollIntoView(c, t);
  }, [selectedFrameIndex]);

  const showSkeletons = isLoading && !timeline.length;

  return (
    <div className="d-flex gap-1 overflow-x-auto raster-thumbnails" ref={thumbnailsRef} style={{ paddingBlock: '.25rem' }}>
      {showSkeletons
        ? Array.from({ length: 8 }, (_, i) => <ThumbnailSkeleton key={`thumb-skel-${i}`} />)
        : timeline.map((ts, idx) => {
          const scene = getThumbnailScene(ts);
          if (!scene) return null;
          const isActive = idx === selectedFrameIndex;
          return (
            <div
              key={`thumb-${ts}-${scene.model}`}
              ref={(el) => {
                itemsRef.current[idx] = el;
              }}
            >
              <ThumbnailItem
                scene={scene}
                timestep={ts}
                index={idx}
                isActive={isActive}
                isPlaying={isPlaying}
                selectedFrameIndex={selectedFrameIndex}
                onClick={onThumbnailClick}
              />
            </div>
          );
        })}
    </div>
  );
};

export default React.memo(Thumbnails);
