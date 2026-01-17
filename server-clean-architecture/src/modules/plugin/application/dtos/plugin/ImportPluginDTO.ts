import { PluginProps } from '../../../domain/entities/Plugin';

export interface ImportPluginInputDTO {
    file: any;
    teamId: string;
}

export interface ImportPluginOutputDTO extends PluginProps{}