import React, { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { Vector3, Box3, MathUtils } from 'three';
import { calculateModelBounds } from '@/modules/canvas/presentation/utilities/modelUtils';

type Face = 'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz';

const faceNormal = {
  px: new Vector3(1, 0, 0),
  nx: new Vector3(-1, 0, 0),
  py: new Vector3(0, 1, 0),
  ny: new Vector3(0, -1, 0),
  pz: new Vector3(0, 0, 1),
  nz: new Vector3(0, 0, -1)
} as const;

const faceCenter = (box: Box3, face: Face) => {
  const center = box.getCenter(new Vector3());
  const { min, max } = box;
  switch (face) {
    case 'px': return new Vector3(max.x, center.y, center.z);
    case 'nx': return new Vector3(min.x, center.y, center.z);
    case 'py': return new Vector3(center.x, max.y, center.z);
    case 'ny': return new Vector3(center.x, min.y, center.z);
    case 'pz': return new Vector3(center.x, center.y, max.z);
    case 'nz': return new Vector3(center.x, center.y, min.z);
  }
};

const planeDims = (size: Vector3, face: Face) => {
  switch (face) {
    case 'px':
    case 'nx': return { w: size.y, h: size.z };
    case 'py':
    case 'ny': return { w: size.x, h: size.z };
    case 'pz':
    case 'nz': return { w: size.x, h: size.y };
  }
};

const planeUp = (face: Face) => (face === 'pz' || face === 'nz') ? new Vector3(0, 1, 0) : new Vector3(0, 0, 1);

interface Props {
  modelBounds?: ReturnType<typeof calculateModelBounds>;
  orbitControlsRef?: any;
  face?: Face;
  padding?: number;
}

const CameraManager: React.FC<Props> = ({
  modelBounds,
  orbitControlsRef,
  face = 'pz',
  centerCamera = false,
  padding = 1.2
}: Props & { centerCamera?: boolean }) => {
  const { camera, size, controls: defaultControls } = useThree() as any;

  useEffect(() => {
    if (!modelBounds) return;
    if (!centerCamera) return;

    const controls = orbitControlsRef?.current ?? defaultControls;
    const box = modelBounds.box;
    const size3 = box.getSize(new Vector3());
    const { w, h } = planeDims(size3, face);
    const up = planeUp(face);
    const normal = faceNormal[face].clone();

    const fovY = MathUtils.degToRad(camera.fov);
    const aspect = size.width / size.height;
    const distH = (h * 0.5) / Math.tan(fovY / 2);
    const distW = (w * 0.5) / (Math.tan(fovY / 2) * aspect);
    const dist = Math.max(distH, distW) * padding;

    const target = faceCenter(box, face);
    const pos = target.clone().addScaledVector(normal, dist);

    camera.up.copy(up);
    camera.near = Math.max(0.01, dist * 0.01);
    camera.far = dist * 100;
    camera.updateProjectionMatrix();
    if (controls?.setLookAt) {
      controls.setLookAt(pos.x, pos.y, pos.z, target.x, target.y, target.z, true);
    } else {
      controls?.object?.position.copy(pos);
      controls?.target?.copy(target);
      controls?.update?.();

      camera.position.copy(pos);
      camera.lookAt(target);
    }
  }, [modelBounds, face, padding, size, camera, orbitControlsRef, defaultControls, centerCamera]);

  return null;
};

export default CameraManager;
