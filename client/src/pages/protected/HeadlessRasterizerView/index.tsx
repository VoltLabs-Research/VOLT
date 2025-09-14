import { useEffect, useRef, useState, useCallback } from 'react';
import { useRasterizedFrames } from '@/hooks/trajectory/use-raster';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { GoArrowUpRight } from 'react-icons/go';
import { IoPlayOutline, IoPauseOutline, IoChevronBack, IoChevronForward } from 'react-icons/io5';
import Skeleton from '@mui/material/Skeleton';
import './HeadlessRasterizerView.css';

interface RasterSceneProps {
    scene: {
        frame: number | null;
        filename: string;
        src?: string | null;
        data?: string;
        url?: string;
    };
    trajectory: any;
    disableAnimation?: boolean;
    isPlaying: boolean;
    onPlayPause: () => void;
    onPrev: () => void;
    onNext: () => void;
}

const RasterScene: React.FC<RasterSceneProps> = ({
    scene,
    trajectory,
    disableAnimation,
    isPlaying,
    onPlayPause,
    onPrev,
    onNext
}) => {
    if (scene.frame === null) return null;

    return (
        <figure className="raster-scene-container">
            <div className="raster-view-trajectory-name-container raster-floating-container">
                <h3 className="raster-view-trajectory-name">{trajectory?.name}</h3>
            </div>

            <div className="raster-view-trajectory-editor-icon-container raster-floating-container">
                <span className="raster-floating-helper-text">View in Editor</span>
                <GoArrowUpRight />
            </div>

            <div className="raster-view-trajectory-playback-container raster-floating-container">
                <IoChevronBack onClick={onPrev} className="raster-view-trajectory-play-icon" />
                {isPlaying ? (
                    <IoPauseOutline onClick={onPlayPause} className="raster-view-trajectory-play-icon" />
                ) : (
                    <IoPlayOutline onClick={onPlayPause} className="raster-view-trajectory-play-icon" />
                )}
                <IoChevronForward onClick={onNext} className="raster-view-trajectory-play-icon" />
            </div>

            {disableAnimation ? (
                <img key={scene.filename} className="raster-scene" src={scene.src ?? undefined} alt={scene.filename} />
            ) : (
                <AnimatePresence mode="wait">
                    <motion.img
                        key={scene.filename}
                        className="raster-scene"
                        src={scene.src ?? undefined}
                        alt={scene.filename}
                        initial={{ opacity: 0, filter: 'blur(12px)' }}
                        animate={{ opacity: 1, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, filter: 'blur(12px)' }}
                        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    />
                </AnimatePresence>
            )}
        </figure>
    );
};

const RasterView: React.FC = () => {
    const { trajectoryId } = useParams<{ trajectoryId: string }>();
    const { items, trajectory, byFrame, loading } = useRasterizedFrames(trajectoryId);

    const [selectedIndex, setSelectedIndex] = useState(0);
    const [selectedType, setSelectedType] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    const thumbnailsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (items.length > 0) setSelectedIndex(0);
    }, [items]);

    const baseFrames = items.filter((item) => !item.filename.includes('_'));
    const typeFrames =
        selectedType != null
            ? Object.values(byFrame).flat().filter((a) => a.type === selectedType)
            : [];
    const activeList = selectedType ? typeFrames : baseFrames;

    const activeIndex = activeList.findIndex((frame) => frame.frame === items[selectedIndex]?.frame);

    useEffect(() => {
        if (!isPlaying || activeList.length === 0) return;
        const interval = setInterval(() => {
            handleNext();
        }, 200);
        return () => clearInterval(interval);
    }, [isPlaying, activeList]);

    const handlePlayPause = () => setIsPlaying((prev) => !prev);
    const handlePrev = () => {
        if (activeList.length === 0) return;
        const prev = (activeIndex - 1 + activeList.length) % activeList.length;
        const prevFrame = activeList[prev];
        setSelectedIndex(items.findIndex((i) => i.frame === prevFrame.frame));
    };
    const handleNext = () => {
        if (activeList.length === 0) return;
        const next = (activeIndex + 1) % activeList.length;
        const nextFrame = activeList[next];
        setSelectedIndex(items.findIndex((i) => i.frame === nextFrame.frame));
    };

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.ctrlKey && e.key === 'Enter') {
            setIsPlaying((prev) => !prev);
        }
    }, []);
    
    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    const currentFrame = items[selectedIndex]?.frame ?? null;
    const baseScene = items[selectedIndex];
    const analysesForFrame = currentFrame != null ? byFrame?.[currentFrame] ?? [] : [];
    const selectedScene =
        currentFrame != null && selectedType
            ? analysesForFrame.find((a) => a.type === selectedType) ?? baseScene
            : baseScene;

    let sceneAnalyses = analysesForFrame;
    if (selectedType && currentFrame != null) {
        sceneAnalyses = [baseScene, ...analysesForFrame.filter((a) => a.type !== selectedType)];
    }

    return (
        <main className="raster-view-container">
            <div className="raster-scenes-container">
                <div className="raster-scenes-top-container">
                    {loading ? (
                        <>
                            <div className="raster-scene-container">
                                <Skeleton
                                    variant="rectangular"
                                    width="100%"
                                    height="100%"
                                    sx={{ borderRadius: '1rem' }}
                                />
                            </div>

                            <div className="raster-analyses-container">
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <Skeleton
                                        key={i}
                                        variant="rectangular"
                                        width={280}
                                        height={150}
                                        sx={{ borderRadius: '1rem' }}
                                    />
                                ))}
                            </div>
                        </>
                    ) : (
                        <>
                            {selectedScene && (
                                <RasterScene
                                    key={`${selectedScene.frame}-${selectedScene.filename}`}
                                    scene={selectedScene}
                                    trajectory={trajectory}
                                    disableAnimation={isPlaying}
                                    isPlaying={isPlaying}
                                    onPlayPause={handlePlayPause}
                                    onPrev={handlePrev}
                                    onNext={handleNext}
                                />
                            )}
                            <div className="raster-analyses-container">
                                {sceneAnalyses.map((analysis) => (
                                    <motion.img
                                        key={`${analysis.frame}-${analysis.type ?? 'frame'}-${analysis.filename}`}
                                        className="raster-analysis-scene"
                                        src={analysis.src ?? undefined}
                                        alt={`${analysis.type ?? 'Frame'} - Frame ${analysis.frame}`}
                                        title={analysis.type ?? 'Frame'}
                                        whileHover={{ scale: 1.08, boxShadow: '0 15px 30px rgba(0,0,0,0.4)' }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => setSelectedType(analysis.type ?? null)}
                                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                                    />
                                ))}
                            </div>
                        </>
                    )}
                </div>

                <div className="raster-thumbnails" ref={thumbnailsRef}>
                    {loading
                        ? Array.from({ length: 10 }).map((_, i) => (
                              <Skeleton
                                  key={i}
                                  variant="rectangular"
                                  width={280}
                                  height={200}
                                  sx={{ borderRadius: '1rem', flexShrink: 0 }}
                              />
                          ))
                        : activeList.map((frame, index) => (
                              <motion.img
                                  key={`${frame.frame}-${frame.filename}-thumb`}
                                  className={`raster-thumbnail ${index === activeIndex ? 'selected' : ''}`}
                                  src={frame.src ?? undefined}
                                  alt={`${frame.type ?? 'Frame'} - Frame ${frame.frame}`}
                                  whileHover={{
                                      scale: 1.05,
                                      boxShadow: '0 10px 25px rgba(0,0,0,0.35)',
                                  }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() =>
                                      setSelectedIndex(items.findIndex((i) => i.frame === frame.frame))
                                  }
                                  transition={{ type: 'spring', stiffness: 280, damping: 22 }}
                              />
                          ))}
                </div>
            </div>
        </main>
    );
};

export default RasterView;
