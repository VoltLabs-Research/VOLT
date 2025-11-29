import type { FC } from 'react';
import type { Scene3DRef } from '@/components/organisms/scene/Scene3D';

interface AutoPreviewSaverProps{
    scene3DRef: React.RefObject<Scene3DRef>;
    delay?: number;
    trajectoryId: string;
    cooldownMs?: number;
}

const AutoPreviewSaver: FC<AutoPreviewSaverProps> = () => null;

export default AutoPreviewSaver;
