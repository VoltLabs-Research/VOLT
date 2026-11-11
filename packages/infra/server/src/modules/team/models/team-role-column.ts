import { Column } from 'typeorm';
import { ENTITY_ID_LENGTH } from '@shared/persistence/entity-id';

// Keeps the type and length the column had while it referenced a team_roles row, so synchronize
// leaves the stored values alone. It now holds a TeamRole key.
export const TeamRoleColumn = (): PropertyDecorator => Column({
    type: 'varchar',
    length: ENTITY_ID_LENGTH
});
