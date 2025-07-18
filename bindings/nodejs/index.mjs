import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const addon = require('../../opendxa/build/opendxa_node.node');

export const {
    LatticeStructure,
    IdentificationMode,
    compute,
    computeTrajectory,
    setCrystalStructure,
    setMaxTrialCircuitSize,
    setCircuitStretchability,
    setOnlyPerfectDislocations,
    setMarkCoreAtoms,
    setLineSmoothingLevel,
    setLinePointInterval,
    setDefectMeshSmoothingLevel,
    setIdentificationMode,
    setProgressCallback,
    reset,
    isValidLatticeStructure,
    isValidIdentificationMode
} = addon;

export default addon;