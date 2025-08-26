import { EffectComposer, SSAO } from '@react-three/postprocessing';
import useRenderConfigStore from '@/stores/editor/render-config';

const DefectLighting = () => {
    const ssaoConfig = useRenderConfigStore((state) => state.SSAO);

    return (
        <>
            <ambientLight intensity={0.15} />
            <directionalLight
                castShadow
                position={[10, 15, -5]}
                intensity={2.0}
                shadow-mapSize={[256, 256]}
                shadow-bias={-0.0001}
                shadow-camera-near={1}
                shadow-camera-far={30}
                shadow-camera-left={-15}
                shadow-camera-right={15}
                shadow-camera-top={15}
                shadow-camera-bottom={-15}
            />
            <directionalLight
                position={[-10, 5, 10]}
                intensity={0.2}
            />
            <EffectComposer enableNormalPass multisampling={0} renderPriority={1}>
                <SSAO {...ssaoConfig} />
            </EffectComposer>
        </>
    );
};

export default DefectLighting;