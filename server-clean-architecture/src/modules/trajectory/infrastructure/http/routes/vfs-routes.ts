import { Router } from 'express';
import { container } from 'tsyringe';
import multer from 'multer';
import { protect } from '@/src/shared/infrastructure/http/middleware/authentication';

import ListVFSDirectoryController from '../controllers/vfs/ListVFSDirectoryController';
import GetVFSFileController from '../controllers/vfs/GetVFSFileController';
import UploadVFSFileController from '../controllers/vfs/UploadVFSFileController';
import DeleteVFSFileController from '../controllers/vfs/DeleteVFSFileController';
import DownloadVFSArchiveController from '../controllers/vfs/DownloadVFSArchiveController';
import GetTrajectoriesByTeamIdController from '../controllers/GetTrajectoriesByTeamIdController';

const listVFSDirectoryController = container.resolve(ListVFSDirectoryController);
const getVFSFileController = container.resolve(GetVFSFileController);
const uploadVFSFileController = container.resolve(UploadVFSFileController);
const deleteVFSFileController = container.resolve(DeleteVFSFileController);
const downloadVFSArchiveController = container.resolve(DownloadVFSArchiveController);
const getTrajectoriesByTeamIdController = container.resolve(GetTrajectoriesByTeamIdController);

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(protect);

router.get('/:teamId/trajectories', getTrajectoriesByTeamIdController.handle);

router.get('/:trajectoryId/archive', downloadVFSArchiveController.handle);
router.get('/:trajectoryId/files', getVFSFileController.handle);

// Standard VFS operations on root /:trajectoryId
router.route('/:trajectoryId')
    .get(listVFSDirectoryController.handle)
    .post(upload.single('file'), uploadVFSFileController.handle)
    .delete(deleteVFSFileController.handle);

export default router;
