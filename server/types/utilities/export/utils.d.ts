export interface MeshAttributes {
    [semantic: string]: {
        data: Buffer;
        stride: number;
    };
}
