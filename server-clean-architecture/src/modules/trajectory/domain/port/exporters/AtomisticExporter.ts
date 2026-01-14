export enum GradientType {
    Viridis = 0,
    Plasma = 1,
    BlueRed = 2,
    Grayscale = 3
};

export interface PrimitiveAtom{
    id: number;
    pos: [number, number, number];
};

export interface AtomsGroupedByType{
    [typeName: string]: PrimitiveAtom[];
};

export interface IAtomisticExporter{
    toStorage(
        filePath: string,
        objectName: string
    ): Promise<void>;
};