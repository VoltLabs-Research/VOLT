import spatialAssembler from '@voltstack/spatial-assembler';

export const encodeFrameModel = (positions: Float32Array, types: Uint16Array): Buffer =>
    spatialAssembler.encodePointCloud(positions, spatialAssembler.colorsByType(types));
