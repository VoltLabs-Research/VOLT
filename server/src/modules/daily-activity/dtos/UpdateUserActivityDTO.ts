export interface UpdateUserActivityInputDTO {
    teamId: string;
    userId: string;
    durationInMinutes: number;
}

export interface UpdateUserActivityOutputDTO {
    success: boolean;
}
