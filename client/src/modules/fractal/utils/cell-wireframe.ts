import * as THREE from 'three';
import type { BoxBounds } from '@volt/contracts/modules/trajectory/domain';

export interface CellPbc {
    x: boolean;
    y: boolean;
    z: boolean;
}

const EDGE_CORNER_PAIRS: ReadonlyArray<readonly [number, number]> = [
    [0, 1], [0, 2], [0, 4],
    [1, 3], [1, 5],
    [2, 3], [2, 6],
    [4, 5], [4, 6],
    [3, 7], [5, 7], [6, 7]
];

const cornerOffset = (
    corner: number,
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Vector3
): THREE.Vector3 => {
    const out = new THREE.Vector3();
    if (corner & 1) out.add(a);
    if (corner & 2) out.add(b);
    if (corner & 4) out.add(c);
    return out;
};

const isVec3 = (v: number[] | undefined): v is number[] => Array.isArray(v) && v.length === 3;

export const hasValidCellVectors = (cellVectors: number[][] | undefined): boolean => {
    if (!cellVectors || cellVectors.length !== 3) return false;
    if (!cellVectors.every(isVec3)) return false;
    const a = new THREE.Vector3(...cellVectors[0]);
    const b = new THREE.Vector3(...cellVectors[1]);
    const c = new THREE.Vector3(...cellVectors[2]);
    const triple = Math.abs(a.dot(new THREE.Vector3().crossVectors(b, c)));
    return triple > 1e-9;
};

export const buildCellWireframeGeometry = (
    cellVectors: number[][],
    cellOrigin: number[] | undefined,
    options: { pbc?: CellPbc; showPbcImages?: boolean } = {}
): THREE.BufferGeometry => {
    const a = new THREE.Vector3(...cellVectors[0]);
    const b = new THREE.Vector3(...cellVectors[1]);
    const c = new THREE.Vector3(...cellVectors[2]);
    const origin = isVec3(cellOrigin)
        ? new THREE.Vector3(...cellOrigin)
        : new THREE.Vector3(0, 0, 0);

    const corners: THREE.Vector3[] = [];
    for (let corner = 0; corner < 8; corner += 1) {
        corners.push(origin.clone().add(cornerOffset(corner, a, b, c)));
    }

    const axisShifts = (enabled: boolean | undefined): number[] => (enabled ? [-1, 0, 1] : [0]);
    const { pbc, showPbcImages } = options;
    const shiftsA = showPbcImages ? axisShifts(pbc?.x) : [0];
    const shiftsB = showPbcImages ? axisShifts(pbc?.y) : [0];
    const shiftsC = showPbcImages ? axisShifts(pbc?.z) : [0];

    const points: number[] = [];
    for (const sa of shiftsA) {
        for (const sb of shiftsB) {
            for (const sc of shiftsC) {
                const imageOffset = new THREE.Vector3()
                    .addScaledVector(a, sa)
                    .addScaledVector(b, sb)
                    .addScaledVector(c, sc);
                for (const [from, to] of EDGE_CORNER_PAIRS) {
                    const p0 = corners[from].clone().add(imageOffset);
                    const p1 = corners[to].clone().add(imageOffset);
                    points.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
                }
            }
        }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    return geometry;
};

export const buildAabbWireframeGeometry = (boxBounds: BoxBounds): THREE.BufferGeometry => {
    const { xlo, xhi, ylo, yhi, zlo, zhi } = boxBounds;
    const points = [
        xlo, ylo, zlo, xhi, ylo, zlo,
        xhi, ylo, zlo, xhi, yhi, zlo,
        xhi, yhi, zlo, xlo, yhi, zlo,
        xlo, yhi, zlo, xlo, ylo, zlo,

        xlo, ylo, zhi, xhi, ylo, zhi,
        xhi, ylo, zhi, xhi, yhi, zhi,
        xhi, yhi, zhi, xlo, yhi, zhi,
        xlo, yhi, zhi, xlo, ylo, zhi,

        xlo, ylo, zlo, xlo, ylo, zhi,
        xhi, ylo, zlo, xhi, ylo, zhi,
        xhi, yhi, zlo, xhi, yhi, zhi,
        xlo, yhi, zlo, xlo, yhi, zhi
    ];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    return geometry;
};
