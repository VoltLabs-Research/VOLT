import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { Fog } from 'three';
import useEnvironmentConfigStore from '@/stores/editor/environment-config';

const DynamicEnvironment = () => {
    const { scene, gl } = useThree();
    const enableFog = useEnvironmentConfigStore((store) => store.enableFog);
    const fogColor = useEnvironmentConfigStore((store) => store.fogColor);
    const fogNear = useEnvironmentConfigStore((store) => store.fogNear);
    const fogFar = useEnvironmentConfigStore((store) => store.fogFar);
    const toneMappingExposure = useEnvironmentConfigStore((store) => store.toneMappingExposure);

    useEffect(() => {
        if(enableFog){
            scene.fog = new Fog(fogColor, fogNear, fogFar);
        }else{
            scene.fog = null;
        }

        return() => {
            scene.fog = null;
        };
    }, [scene, enableFog, fogColor, fogNear, fogFar]);

    useEffect(() => {
        gl.toneMappingExposure = toneMappingExposure;
    }, [gl, toneMappingExposure]);

    return null;
};

export default DynamicEnvironment;
