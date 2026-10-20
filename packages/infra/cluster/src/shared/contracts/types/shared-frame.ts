export interface SharedFrameColumn {
    name: string;
    dtype: string;
    shape: number[];
    data: ArrayBufferView;
}

export interface SharedFramePublishInput {
    columns: SharedFrameColumn[];
}
