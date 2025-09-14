import { useEffect, useState } from 'react';
import { useRasterizedFrames } from '@/hooks/trajectory/use-raster';
import { useParams } from 'react-router-dom';
import './HeadlessRasterizerView.css';

interface RasterSceneProps {
    scene: {
        frame: number | null;
        filename: string;
        src?: string | null;
        data?: string;
        url?: string;
    };
    analyses: Array<{
        type: string;
        filename: string;
        frame: number;
        src?: string | null;
        data?: string;
        url?: string;
    }>;
    onSelectAnalysis: (analysis: any) => void;
}

const RasterScene: React.FC<RasterSceneProps> = ({ scene, analyses, onSelectAnalysis }) => {
    if (scene.frame === null) return null;
    
    return (
        <figure className='raster-scene-container'>
            <img
                className='raster-scene'
                src={scene.src}
                alt={scene.frame !== null ? `Frame ${scene.frame}` : scene.filename}
            />
            
            <figcaption className='raster-scene-types-container'>
                <div className='raster-analyses-container'>
                    {analyses.map((analysis, i) => (
                        <img
                            key={`${analysis.frame}-${analysis.type}-${analysis.filename}`}
                            className='raster-analysis-scene'
                            src={analysis.src}
                            alt={`${analysis.type} - Frame ${analysis.frame}`}
                            title={analysis.type}
                            onClick={() => onSelectAnalysis(analysis)}
                        />
                    ))}
                </div>
            </figcaption>
        </figure>
    );
};

const RasterView: React.FC = () => {
    const { trajectoryId } = useParams<{ trajectoryId: string }>();
    const { 
        items, 
        trajectory, 
        byFrame, 
        loading, 
        error,
        hasData,
        totalFrames 
    } = useRasterizedFrames(trajectoryId);

    const [selectedIndex, setSelectedIndex] = useState(0);
    const [analysisFrame, setAnalysisFrame] = useState<number | null>(null);

    useEffect(() => {
        console.log('Raster items:', items);
        console.log('By frame analyses:', byFrame);
        console.log('Total frames with analyses:', totalFrames);
        if(items.length > 0) setSelectedIndex(0);
    }, [items, byFrame, totalFrames]);

    const selectedScene = items[selectedIndex] ?? null;
    const selectedAnalyses = selectedScene?.frame != null ? byFrame?.[selectedScene.frame] ?? [] : [];

    const analysisThumbnails = analysisFrame != null ? byFrame?.[analysisFrame] ?? [] : [];

    return (
        <main className='raster-view-container'>
            <div className='raster-scenes-container'>
                <div className='raster-view-trajectory-name-container'>
                    <h3 className='raster-view-trajectory-name'>
                        {trajectory?.name}
                    </h3>
                </div>
                {selectedScene && (
                    <RasterScene
                        key={`${selectedScene.frame}-${selectedScene.filename}`}
                        scene={selectedScene}
                        analyses={selectedAnalyses}
                        onSelectAnalysis={(analysis) => setAnalysisFrame(analysis.frame)}
                    />
                )}
                <div className='raster-thumbnails'>
                    {analysisFrame == null ? (
                        items.map((item, index) => (
                            <img
                                key={`${item.frame}-${item.filename}-thumb`}
                                className={`raster-thumbnail ${index === selectedIndex ? 'selected' : ''}`}
                                src={item.src}
                                alt={`Frame ${item.frame}`}
                                onClick={() => setSelectedIndex(index)}
                            />
                        ))
                    ) : (
                        analysisThumbnails.map((analysis, index) => (
                            <img
                                key={`${analysis.frame}-${analysis.filename}-thumb`}
                                className='raster-thumbnail'
                                src={analysis.src}
                                alt={`${analysis.type} - Frame ${analysis.frame}`}
                                onClick={() => setSelectedIndex(items.findIndex(i => i.frame === analysis.frame))}
                            />
                        ))
                    )}
                </div>
            </div>
        </main>
    );
};

export default RasterView;
