import { IBaseRepository } from "@/src/shared/domain/ports/IBaseRepository";
import ListingRow, { ListingRowProps } from "../entities/ListingRow";

export interface IListingRowRepository extends IBaseRepository<ListingRow, ListingRowProps>{

};