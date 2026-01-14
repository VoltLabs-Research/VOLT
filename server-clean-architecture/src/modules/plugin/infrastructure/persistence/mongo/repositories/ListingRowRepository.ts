import { IListingRowRepository } from "@/src/modules/plugin/domain/ports/IListingRowRepository";
import ListingRow, { ListingRowProps } from "@/src/modules/plugin/domain/entities/ListingRow";
import ListingRowModel, { ListingRowDocument } from "../models/ListingRowModel";
import listingRowMapper from '../mappers/ListingRowMapper';
import { MongooseBaseRepository } from "@/src/shared/infrastructure/persistence/mongo/MongooseBaseRepository";
import { injectable } from "tsyringe";

@injectable()
export default class ListingRowRepository
    extends MongooseBaseRepository<ListingRow, ListingRowProps, ListingRowDocument>
    implements IListingRowRepository{

    constructor(){
        super(ListingRowModel, listingRowMapper);
    }
};