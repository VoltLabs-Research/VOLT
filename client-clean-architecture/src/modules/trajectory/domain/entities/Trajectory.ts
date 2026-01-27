import type { Analysis } from '@/types/models';

export interface Trajectory {
    _id: string;
    name: string;
    path: string;
    totalFrames: number;
    status: string;
    preview: string;
    updatedAt: string;
    createdBy: any; 
    team?: any; 
    analysis?: Analysis[];
    frames?: Array<{ timestep: number; [key: string]: any }>;
    stats?: {
        totalSize: number;
        [key: string]: any;
    };
    processingProgress?: {
        stage: string;
        currentStep: number;
        totalSteps: number;
        percentage: number;
        message?: string;
    };
    availableModels?: {
        atomicStructure: boolean;
        dislocations: boolean;
        bonds: boolean;
        simulationCell: boolean;
        structureIdentification: boolean;
    };
    isPublic?: boolean;
}
