import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { Fog } from 'three';
import { useEditorStore } from '@/stores/slices/editor';

const DynamicEnvironment = () => {
    const { scene, gl } = useThree();
    const enableFog = useEditorStore((store) => store.environment.enableFog);
    const fogColor = useEditorStore((store) => store.environment.fogColor);
    const fogNear = useEditorStore((store) => store.environment.fogNear);
    const fogFar = useEditorStore((store) => store.environment.fogFar);
    const toneMappingExposure = useEditorStore((store) => store.environment.toneMappingExposure);

    useEffect(() => {
        if (enableFog) {
            scene.fog = new Fog(fogColor, fogNear, fogFar);
        } else {
            scene.fog = null;
        }

        return () => {
            scene.fog = null;
        };
    }, [scene, enableFog, fogColor, fogNear, fogFar]);

    useEffect(() => {
        gl.toneMappingExposure = toneMappingExposure;
    }, [gl, toneMappingExposure]);

    return null;
};

export default DynamicEnvironment;
