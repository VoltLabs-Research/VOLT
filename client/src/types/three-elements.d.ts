import { Object3DNode } from '@react-three/fiber';

declare global {
    namespace JSX {
        interface IntrinsicElements {
            primitive: Object3DNode<THREE.Object3D, typeof THREE.Object3D> & { object: THREE.Object3D };
            group: Object3DNode<THREE.Group, typeof THREE.Group>;
            lineSegments: Object3DNode<THREE.LineSegments, typeof THREE.LineSegments>;
            lineBasicMaterial: Object3DNode<THREE.LineBasicMaterial, typeof THREE.LineBasicMaterial>;
        }
    }
}
