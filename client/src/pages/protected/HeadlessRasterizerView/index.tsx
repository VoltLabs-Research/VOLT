import { useEffect } from 'react';
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
}

const RasterScene: React.FC<RasterSceneProps> = ({ scene, analyses }) => {
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
                            key={`${analysis.type}-${analysis.filename}-${i}`}
                            className='raster-analysis-scene'
                            src={analysis.src}
                            alt={`${analysis.type} - Frame ${analysis.frame}`}
                            title={analysis.type}
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

    useEffect(() => {
        console.log('Raster items:', items);
        console.log('By frame analyses:', byFrame);
        console.log('Total frames with analyses:', totalFrames);
    }, [items, byFrame, totalFrames]);

    return (
        <main className='raster-view-container'>
            <div className='raster-scenes-container'>
                <div className='raster-view-trajectory-name-container'>
                    <h3 className='raster-view-trajectory-name'>
                        {trajectory?.name}
                    </h3>
                </div>
                {items.map((item, index) => (
                    <RasterScene
                        key={`${item.filename}-${index}`}
                        scene={item}
                        analyses={item.frame != null ? byFrame?.[item.frame] ?? [] : []}
                    />
                ))}
            </div>
        </main>
    );
};

export default RasterView;