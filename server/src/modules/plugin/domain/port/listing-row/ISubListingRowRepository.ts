import SubListingRow, { SubListingRowProps } from '@modules/plugin/domain/entities/listing-row/SubListingRow';

import { IBaseRepository } from '@shared/domain/port/IBaseRepository';

export interface ISubListingRowRepository extends IBaseRepository<SubListingRow, SubListingRowProps> {

};
