import { IBaseRepository } from "@/src/shared/domain/ports/IBaseRepository";
import Plugin, { PluginProps } from "../entities/Plugin";

export interface IPluginRepository extends IBaseRepository<Plugin, PluginProps>{

};