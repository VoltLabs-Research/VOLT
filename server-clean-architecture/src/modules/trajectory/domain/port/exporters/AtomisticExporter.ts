export enum GradientType {
    Viridis = 0,
    Plasma = 1,
    BlueRed = 2,
    Grayscale = 3
};

export interface PrimitiveAtom {
    id: number;
    pos: [number, number, number];
};

export interface AtomsGroupedByType {
    [typeName: string]: PrimitiveAtom[];
};

export interface IAtomisticExporter {
    toStorage(
        filePath: string,
        objectName: string
    ): Promise<void>;

    exportColoredByProperty(
        filePath: string,
        objectName: string,
        property: string,
        startValue: number,
        endValue: number,
        gradientName: string,
        externalValues?: Float32Array
    ): Promise<void>;

    exportAtomsTypeToGLBBuffer(
        atomsByType: AtomsGroupedByType,
        objectName: string
    ): Promise<void>;
};