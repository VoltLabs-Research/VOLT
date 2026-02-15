import type {
    GetPluginsInputDTO,
    GetPluginsOutputDTO,
    GetPluginInputDTO,
    GetPluginOutputDTO,
    CreatePluginInputDTO,
    CreatePluginOutputDTO,
    UpdatePluginInputDTO,
    UpdatePluginOutputDTO,
    ExecutePluginInputDTO,
    ExecutePluginOutputDTO,
    UploadBinaryInputDTO,
    UploadBinaryOutputDTO
} from '../../application/dtos';
import type { Plugin } from '../entities';

export default interface IPluginRepository {
    getAll(params: GetPluginsInputDTO): Promise<GetPluginsOutputDTO>;
    getById(params: GetPluginInputDTO): Promise<GetPluginOutputDTO>;
    create(data: CreatePluginInputDTO): Promise<CreatePluginOutputDTO>;
    update(params: UpdatePluginInputDTO): Promise<UpdatePluginOutputDTO>;
    clone(pluginId: string, teamId: string): Promise<Plugin>;
    delete(id: string): Promise<void>;
    execute(params: ExecutePluginInputDTO): Promise<ExecutePluginOutputDTO>;
    exportPlugin(id: string): Promise<Blob>;
    exportAnalysisResults(pluginSlug: string, analysisId: string): Promise<Blob>;
    importPlugin(file: File): Promise<Plugin>;
    uploadBinary(params: UploadBinaryInputDTO): Promise<UploadBinaryOutputDTO>;
    deleteBinary(id: string): Promise<void>;
};
