import Plugin, { PluginProps } from "@/src/modules/plugin/domain/entities/Plugin";
import { PluginDocument } from "../models/PluginModel";
import { BaseMapper } from "@/src/shared/infrastructure/persistence/mongo/MongoBaseMapper";

class PluginMapper extends BaseMapper<Plugin, PluginProps, PluginDocument>{
    constructor(){
        super(Plugin, [
            'team'
        ]);
    }
};

export default new PluginMapper();