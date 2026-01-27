import React, { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { Vector3, MathUtils } from 'three';
import { calculateCameraPositionForFace } from '@/modules/canvas/domain/services/GeometryCalculationService';
import type { ModelBounds } from '@/modules/canvas/domain/value-objects/ModelBounds';
import type { ViewFace } from '@/modules/canvas/domain/value-objects/ViewFace';

interface Props {
  modelBounds?: ModelBounds;
  orbitControlsRef?: any;
  face?: ViewFace;
  padding?: number;
  centerCamera?: boolean;
}

const CameraManager: React.FC<Props> = ({
  modelBounds,
  orbitControlsRef,
  face = 'pz',
  centerCamera = false,
  padding = 1.2,
}) => {
  const { camera, size, controls: defaultControls } = useThree() as any;

  useEffect(() => {
    if (!modelBounds || !centerCamera) return;

    const controls = orbitControlsRef?.current ?? defaultControls;
    const fovDegrees = camera.fov;
    const aspectRatio = size.width / size.height;

    const { position: pos, target, up } = calculateCameraPositionForFace(
      modelBounds.center,
      modelBounds.size,
      face,
      fovDegrees,
      aspectRatio,
      padding
    );

    camera.up.set(up.x, up.y, up.z);
    
    // Near/Far logic (Infrastructure/Presentation concern, keeping it here)
    const distanceVector = new Vector3(pos.x - target.x, pos.y - target.y, pos.z - target.z);
    const dist = distanceVector.length();
    
    camera.near = Math.max(0.01, dist * 0.01);
    camera.far = dist * 100;
    camera.updateProjectionMatrix();

    if (controls?.setLookAt) {
      controls.setLookAt(pos.x, pos.y, pos.z, target.x, target.y, target.z, true);
    } else {
      controls?.object?.position.set(pos.x, pos.y, pos.z);
      controls?.target?.set(target.x, target.y, target.z);
      controls?.update?.();

      camera.position.set(pos.x, pos.y, pos.z);
      camera.lookAt(target.x, target.y, target.z);
    }
  }, [modelBounds, face, padding, size, camera, orbitControlsRef, defaultControls, centerCamera]);

  return null;
};

export default CameraManager;
