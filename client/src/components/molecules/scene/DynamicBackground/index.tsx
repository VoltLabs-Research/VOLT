import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { Color } from 'three';
import useEnvironmentConfigStore from '@/stores/editor/environment-config';

const DynamicBackground = () => {
    const { scene } = useThree();
    const { backgroundColor, backgroundType } = useEnvironmentConfigStore();

    useEffect(() => {
        if(backgroundType === 'color'){
            scene.background = new Color(backgroundColor);
        }else{
            scene.background = null;
        }
    }, [scene, backgroundColor, backgroundType]);

    return null;
};

export default DynamicBackground;