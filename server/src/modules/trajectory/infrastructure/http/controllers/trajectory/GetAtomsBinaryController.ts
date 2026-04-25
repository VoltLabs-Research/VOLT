import { GetAtomsUseCase } from '@modules/trajectory/application/use-cases/trajectory/GetAtomsUseCase';
import { createAtomsBinaryController } from '@modules/trajectory/infrastructure/http/controllers/atoms-binary-controller';

export default createAtomsBinaryController(GetAtomsUseCase);
