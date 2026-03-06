import { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import SubListingRow, { SubListingRowProps } from '@modules/plugin/domain/entities/SubListingRow';

export interface ISubListingRowRepository extends IBaseRepository<SubListingRow, SubListingRowProps> {

}
