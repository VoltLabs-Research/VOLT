import React from 'react';
import { Skeleton } from '@mui/material';

function useIsMobile(breakpointPx: number = 768){
    const [isMobile, setIsMobile] = React.useState<boolean>(() =>
        typeof window !== 'undefined' ? window.innerWidth <= breakpointPx : false
    );

    React.useEffect(() => {
        if(typeof window === 'undefined') return;
        const mq = window.matchMedia(`(max-width: ${breakpointPx}px)`);
        const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
        // Initialize & subscribe
        setIsMobile(mq.matches);
        mq.addEventListener?.('change', onChange);
        return() => mq.removeEventListener?.('change', onChange);
    }, [breakpointPx]);

    return isMobile;
}

const RasterSceneSkeleton: React.FC = () => {
    const isMobile = useIsMobile(768);

    const frameWidth = isMobile ? 'min(22vw, 44vw)' : 'min(5vw, 44vw)';
    const playbackWidth = isMobile ? 'min(32vw, 60vw)' : 'min(8vw, 60vw)';

    return(
        <figure className='raster-scene-container' style={{ flex: 1, minWidth: 0 }}>
            <div className='raster-scene-main'>
                <Skeleton
                    variant='rectangular'
                    animation='wave'
                    width='100%'
                    height={'var(--raster-scene-height)'}
                    sx={{
                        borderRadius: '0.75rem',
                        bgcolor: 'rgba(255, 255, 255, 0.06)'
                    }}
                />
            </div>

            <div className='raster-skel raster-skel-select'>
                <Skeleton
                    variant='rounded'
                    animation='wave'
                    height={40}
                    sx={{
                        borderRadius: '0.75rem',
                        bgcolor: 'rgba(255, 255, 255, 0.10)'
                    }}
                />
            </div>

            {/* Frame index skeleton(responsive) */}
            <div className='raster-skel raster-skel-frame'>
                <Skeleton
                    variant='rounded'
                    animation='wave'
                    width={frameWidth}
                    height={'clamp(30px, 5vh, 44px)'}
                    sx={{
                        borderRadius: '9999px',
                        bgcolor: 'rgba(255, 255, 255, 0.10)'
                    }}
                />
            </div>

            {/* Playback controls skeleton(responsive) */}
            <div className='raster-skel raster-skel-playback'>
                <Skeleton
                    variant='rounded'
                    animation='wave'
                    width={playbackWidth}
                    height={'clamp(32px, 6vh, 42px)'}
                    sx={{
                        borderRadius: '9999px',
                        bgcolor: 'rgba(255, 255, 255, 0.12)'
                    }}
                />
            </div>

            <div className='raster-skel raster-skel-rail' style={{ width: 'min(132px, 24vw)' }}>
                {Array.from({ length: 4 }, (_, i) => (
                    <Skeleton
                        key={`rail-skel-${i}`}
                        variant='rounded'
                        animation='wave'
                        height={'clamp(68px, 12vh, 84px)'}
                        width={'100%'}
                        sx={{
                            borderRadius: '0.75rem',
                            bgcolor: 'rgba(255, 255, 255, 0.08)'
                        }}
                    />
                ))}
            </div>
        </figure>
    );
};

export default RasterSceneSkeleton;
