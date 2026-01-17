export interface ValidateWorkflowInputDTO {
    workflow: any;
}

export interface ValidateWorkflowOutputDTO {
    validated: boolean;
    errors?: string[];
    modifier?: any;
}
