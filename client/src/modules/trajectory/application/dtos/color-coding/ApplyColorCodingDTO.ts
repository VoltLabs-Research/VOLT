export interface ColorCodingPayload {
    property: string;
    startValue: number;
    endValue: number;
    gradient: string;
    exposureId?: string;
}

export interface ApplyColorCodingInputDTO {
    trajectoryId: string;
    analysisId?: string;
    timestep: number;
    payload: ColorCodingPayload;
}