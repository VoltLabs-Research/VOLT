export interface IWorkflowValidatorService {
    validate(workflow: any): { isValid: boolean; errors?: string[]; modifier?: any };
}
