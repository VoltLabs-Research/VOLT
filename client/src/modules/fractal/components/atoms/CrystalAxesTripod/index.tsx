import { GizmoHelper } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import { CanvasTexture, Quaternion, Vector3 } from 'three';

interface CrystalAxesTripodProps {
    cellVectors: number[][];
    labels?: [string, string, string];
}

const AXIS_COLORS = ['#e5484d', '#46a758', '#3e63dd'] as const;
const DEFAULT_LABELS: [string, string, string] = ['a', 'b', 'c'];
const AXIS_LENGTH = 20;
const AXIS_RADIUS = 1;
const HEAD_LENGTH = 7;
const HEAD_RADIUS = 2.4;
const LABEL_OFFSET = 8;
const UP = new Vector3(0, 1, 0);

const useLabelTexture = (label: string, color: string): CanvasTexture => {
    const texture = useMemo(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const context = canvas.getContext('2d');
        if (context) {
            context.font = 'bold 38px Inter, Arial, sans-serif';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillStyle = color;
            context.fillText(label, 32, 34);
        }
        return new CanvasTexture(canvas);
    }, [label, color]);

    useEffect(() => {
        return () => texture.dispose();
    }, [texture]);

    return texture;
};

interface AxisArrowProps {
    direction: Vector3;
    color: string;
    label: string;
}

const AxisArrow = ({ direction, color, label }: AxisArrowProps) => {
    const quaternion = useMemo(() => new Quaternion().setFromUnitVectors(UP, direction), [direction]);
    const labelPosition = useMemo(() => {
        return direction.clone().multiplyScalar(AXIS_LENGTH + HEAD_LENGTH + LABEL_OFFSET);
    }, [direction]);
    const labelTexture = useLabelTexture(label, color);

    return (
        <>
            <group quaternion={quaternion}>
                <mesh position={[0, AXIS_LENGTH / 2, 0]}>
                    <cylinderGeometry args={[AXIS_RADIUS, AXIS_RADIUS, AXIS_LENGTH, 12]} />
                    <meshStandardMaterial color={color} />
                </mesh>
                <mesh position={[0, AXIS_LENGTH + HEAD_LENGTH / 2, 0]}>
                    <coneGeometry args={[HEAD_RADIUS, HEAD_LENGTH, 12]} />
                    <meshStandardMaterial color={color} />
                </mesh>
            </group>
            <sprite position={labelPosition} scale={[11, 11, 11]}>
                <spriteMaterial map={labelTexture} toneMapped={false} depthTest={false} />
            </sprite>
        </>
    );
};

// Orientation tripod for the simulation cell: arrows follow the actual cell
// vectors (which differ from the world axes for triclinic cells), so the user
// can read the crystal frame the way OVITO's coordinate tripod shows it.
const CrystalAxesTripod = ({ cellVectors, labels = DEFAULT_LABELS }: CrystalAxesTripodProps) => {
    const directions = useMemo(() => {
        return cellVectors.slice(0, 3).map((vector) => {
            const direction = new Vector3(vector?.[0] ?? 0, vector?.[1] ?? 0, vector?.[2] ?? 0);
            return direction.lengthSq() > 1e-12 ? direction.normalize() : null;
        });
    }, [cellVectors]);

    return (
        <GizmoHelper alignment='bottom-left' renderPriority={2} margin={[80, 80]}>
            <directionalLight position={[5, 5, 5]} intensity={1} />
            <ambientLight intensity={0.7} />
            <mesh>
                <sphereGeometry args={[1.8, 16, 16]} />
                <meshStandardMaterial color='#9a9a9f' />
            </mesh>
            {directions.map((direction, index) => (
                direction
                    ? (
                        <AxisArrow
                            key={labels[index]}
                            direction={direction}
                            color={AXIS_COLORS[index]}
                            label={labels[index]}
                        />
                    )
                    : null
            ))}
        </GizmoHelper>
    );
};

export default CrystalAxesTripod;
