import { AtomsGroupedByType, OAtom } from '@/types/utilities/export/atoms';

export enum MissorientationAngleError{
    UndefinedQuaternion = 0,
    DivisionByZero = 1
}

export const computeMissorientationAngle = (atom: OAtom): number => {
    if(!atom?.ptm_quaternion){
        return MissorientationAngleError.UndefinedQuaternion;
    }

    const qx = atom.ptm_quaternion[0];
    const qy = atom.ptm_quaternion[1];
    const qz = atom.ptm_quaternion[2];
    let qw = atom.ptm_quaternion[3];

    if(qw === 0){
        // TODO: warning 
        qw = 1e-4;
    }

    // Dipole Orientation
    const dox = Math.abs(qx / qw);
    const doy = Math.abs(qy / qw);
    const doz = Math.abs(qz / qw);

    // Dipole Magnitude
    const threshold = 1e-9;
    const norm = Math.abs(dox ** 2 + doy ** 2 + doz ** 2);
    const magnitude = (norm > threshold) ? norm : threshold;

    const theta = Math.atan(magnitude);
    
    return theta;
};

export const computeMissorientationDeltas = (groupedAtoms: AtomsGroupedByType, theta0: number) => {
    const atoms = Object.values(groupedAtoms).flat();
    const deltaThetas: number[] = [];

    for(const atom of atoms){
        const theta = computeMissorientationAngle(atom);

        // If atom doesn't have ptm_quaternion property, then we assume
        // that the Dislocation Analysis was performed using CNA and not PTM.
        // Also, nothing to do.
        if(theta === MissorientationAngleError.UndefinedQuaternion){
            return [];
        }else if(theta === MissorientationAngleError.DivisionByZero){
            // If "W" component of quaternion is 0.
            continue;
        }

        const delta = Math.abs(theta - theta0) * (180 / Math.PI);

        deltaThetas.push(delta);
    }

    return deltaThetas;
};

export default computeMissorientationDeltas;