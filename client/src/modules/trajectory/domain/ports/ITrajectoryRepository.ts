import type { Trajectory } from '../entities/Trajectory';
import type { DashboardMetrics } from '@/modules/dashboard/domain/entities';
import type {
    GetTrajectoriesInputDTO,
    GetTrajectoriesOutputDTO,
    CreateTrajectoryOutputDTO,
    GetPreviewInputDTO,
    GetPreviewOutputDTO,
    GetAtomsInputDTO,
    GetAtomsOutputDTO,
    DownloadTrajectoryInputDTO
} from '../../application/dtos/trajectory';

export default interface ITrajectoryRepository{
    getAll(params?: GetTrajectoriesInputDTO): Promise<GetTrajectoriesOutputDTO>;
    getById(id: string): Promise<Trajectory>;
    create(formData: FormData, onProgress?: (progress: number) => void): Promise<CreateTrajectoryOutputDTO>;
    update(id: string, data: Partial<Trajectory>): Promise<Trajectory>;
    delete(id: string): Promise<void>;
    getPreview(params: GetPreviewInputDTO): Promise<GetPreviewOutputDTO>;
    invalidatePreviewCache(trajectoryId: string): void;
    download(params: DownloadTrajectoryInputDTO): Promise<Blob>;
    getMetrics(): Promise<DashboardMetrics>;
    listSamples(): Promise<string[]>;
    downloadSample(filename: string): Promise<Blob>;
    getAtoms(params: GetAtomsInputDTO): Promise<GetAtomsOutputDTO>;
};
