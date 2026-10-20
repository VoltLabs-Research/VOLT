import useFractalSceneConfig from '@/modules/canvas/components/CanvasPage/use-fractal-scene-config';
import FractalScene from '@/modules/fractal/components/organisms/FractalScene';
import LocalGlbViewer from '@/modules/fractal/components/organisms/LocalGlbViewer';

const SAMPLE_URL = `${window.location.origin}/samples/bi-sc-ptm-dxa.glb`;

const LandingCanvas = () => {
    const sceneConfig = useFractalSceneConfig();

    return (
        <div className='relative h-[calc(100dvh-148px)] min-h-[560px] w-full overflow-hidden border border-[var(--lp-line)] bg-[#0c0c0e]'>
            <FractalScene config={sceneConfig} showGrid={false} showGizmo>
                <LocalGlbViewer url={SAMPLE_URL} />
            </FractalScene>
        </div>
    );
};

export default LandingCanvas;
