import { Router } from 'express';
import { container } from 'tsyringe';
import { protect } from '@/src/shared/infrastructure/http/middleware/authentication';
import { canRead, canCreate, canUpdate, canDelete } from '@/src/shared/infrastructure/http/middleware/authorization';
import { Resource } from '@/src/core/constants/resources';
import { CreateContainerController } from '../controllers/CreateContainerController';
import { GetContainerByIdController } from '../controllers/GetContainerByIdController';
import { UpdateContainerController } from '../controllers/UpdateContainerController';
import { GetContainerStatsController } from '../controllers/GetContainerStatsController';
import { GetContainerFilesController } from '../controllers/GetContainerFilesController';
import { ReadContainerFileController } from '../controllers/ReadContainerFileController';
import { GetContainerProcessesController } from '../controllers/GetContainerProcessesController';
import { DeleteContainerController } from '../controllers/DeleteContainerController';
import { ListContainersController } from '../controllers/ListContainersController';

const router = Router();

// Resolve Controllers
const createController = container.resolve<CreateContainerController>(CreateContainerController);
const listController = container.resolve<ListContainersController>(ListContainersController);
const getByIdController = container.resolve<GetContainerByIdController>(GetContainerByIdController);
const updateController = container.resolve<UpdateContainerController>(UpdateContainerController);
const deleteController = container.resolve<DeleteContainerController>(DeleteContainerController);
const statsController = container.resolve<GetContainerStatsController>(GetContainerStatsController);
const filesController = container.resolve<GetContainerFilesController>(GetContainerFilesController);
const readFileController = container.resolve<ReadContainerFileController>(ReadContainerFileController);
const processesController = container.resolve<GetContainerProcessesController>(GetContainerProcessesController);

// All routes require authentication
router.use(protect);

// RBAC-protected routes with /:teamId prefix
router.get('/:teamId', canRead(Resource.CONTAINER), (req, res, next) => listController.handle(req, res, next));
router.post('/:teamId', canCreate(Resource.CONTAINER), (req, res, next) => createController.handle(req, res, next));

router.get('/:teamId/:id', canRead(Resource.CONTAINER), (req, res, next) => getByIdController.handle(req, res, next));
router.patch('/:teamId/:id', canUpdate(Resource.CONTAINER), (req, res, next) => updateController.handle(req, res, next));
router.delete('/:teamId/:id', canDelete(Resource.CONTAINER), (req, res, next) => deleteController.handle(req, res, next));

router.get('/:teamId/:id/stats', canRead(Resource.CONTAINER), (req, res, next) => statsController.handle(req, res, next));
router.get('/:teamId/:id/files', canRead(Resource.CONTAINER), (req, res, next) => filesController.handle(req, res, next));
router.get('/:teamId/:id/files/read', canRead(Resource.CONTAINER), (req, res, next) => readFileController.handle(req, res, next));
router.get('/:teamId/:id/processes', canRead(Resource.CONTAINER), (req, res, next) => processesController.handle(req, res, next));

export default router;

