import ListingRow, { ListingRowProps } from "@/src/modules/plugin/domain/entities/ListingRow";
import { ListingRowDocument } from "../models/ListingRowModel";
import { BaseMapper } from "@/src/shared/infrastructure/persistence/mongo/MongoBaseMapper";

class ListingRowMapper extends BaseMapper<ListingRow, ListingRowProps, ListingRowDocument>{
    constructor(){
        super(ListingRow, [
            'plugin',
            'team',
            'analysis',
            'trajectory'
        ]);
    }
};

export default new ListingRowMapper();