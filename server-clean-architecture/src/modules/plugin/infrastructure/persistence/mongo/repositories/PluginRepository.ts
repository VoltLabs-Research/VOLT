import { IPluginRepository } from "@/src/modules/plugin/domain/ports/IPluginRepository";
import Plugin, { PluginProps } from "@/src/modules/plugin/domain/entities/Plugin";
import PluginModel, { PluginDocument } from "../models/PluginModel";
import pluginMapper from '../mappers/PluginMapper';
import { MongooseBaseRepository } from "@/src/shared/infrastructure/persistence/mongo/MongooseBaseRepository";
import { injectable } from 'tsyringe';

@injectable()
export default class PluginRepository
    extends MongooseBaseRepository<Plugin, PluginProps, PluginDocument>
    implements IPluginRepository{

    constructor(){
        super(PluginModel, pluginMapper);
    }
};