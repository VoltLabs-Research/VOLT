import React, { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { Vector3, Box3, MathUtils } from 'three';
import { calculateModelBounds } from '@/utilities/glb/modelUtils';

type Face = 'px'|'nx'|'py'|'ny'|'pz'|'nz';

const faceNormal = {
  px: new Vector3( 1, 0, 0),
  nx: new Vector3(-1, 0, 0),
  py: new Vector3( 0, 1, 0),
  ny: new Vector3( 0,-1, 0),
  pz: new Vector3( 0, 0, 1),
  nz: new Vector3( 0, 0,-1),
} as const;

const faceCenter = (box: Box3, f: Face) => {
  const c = box.getCenter(new Vector3()), { min, max } = box;
  switch (f) {
    case 'px': return new Vector3(max.x, c.y, c.z);
    case 'nx': return new Vector3(min.x, c.y, c.z);
    case 'py': return new Vector3(c.x, max.y, c.z);
    case 'ny': return new Vector3(c.x, min.y, c.z);
    case 'pz': return new Vector3(c.x, c.y, max.z);
    case 'nz': return new Vector3(c.x, c.y, min.z);
  }
};

const planeDims = (size: Vector3, f: Face) => {
  switch (f) {
    case 'px':
    case 'nx': return { w: size.y, h: size.z }; // YZ
    case 'py':
    case 'ny': return { w: size.x, h: size.z }; // XZ
    case 'pz':
    case 'nz': return { w: size.x, h: size.y }; // XY
  }
};

const planeUp = (f: Face) => (f === 'pz' || f === 'nz') ? new Vector3(0,1,0) : new Vector3(0,0,1);

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
  padding = 1.2,
}) => {
  const { camera, size, controls: defaultControls } = useThree() as any;

  useEffect(() => {
    if (!modelBounds) return;

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
    camera.far  = dist * 100;
    camera.updateProjectionMatrix();

    if (controls?.setLookAt) {
      // sincroniza posición + target + estado interno
      controls.setLookAt(pos.x, pos.y, pos.z, target.x, target.y, target.z, true);
    } else {
      // fallback
      controls?.object?.position.copy(pos);
      controls?.target?.copy(target);
      controls?.update?.();

      camera.position.copy(pos);
      camera.lookAt(target);
    }
  }, [modelBounds, face, padding, size, camera, orbitControlsRef, defaultControls]);

  return null;
};

export default CameraManager;
