import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { Color } from 'three';
import { useEditorStore } from '@/features/canvas/stores/editor';

const DynamicBackground = () => {
    const { scene } = useThree();
    const { backgroundColor, backgroundType } = useEditorStore((s) => s.environment);

    useEffect(() => {
        if (backgroundType === 'color') {
            scene.background = new Color(backgroundColor);
        } else {
            scene.background = null;
        }
    }, [scene, backgroundColor, backgroundType]);

    return null;
};

export default DynamicBackground;
