import { Router } from 'express';
import { container } from 'tsyringe';
import multer from 'multer';
import { protect } from '@shared/infrastructure/http/middleware/authentication';

import ListVFSDirectoryController from '@modules/trajectory/infrastructure/http/controllers/vfs/ListVFSDirectoryController';
import GetVFSFileController from '@modules/trajectory/infrastructure/http/controllers/vfs/GetVFSFileController';
import UploadVFSFileController from '@modules/trajectory/infrastructure/http/controllers/vfs/UploadVFSFileController';
import DeleteVFSFileController from '@modules/trajectory/infrastructure/http/controllers/vfs/DeleteVFSFileController';
import DownloadVFSArchiveController from '@modules/trajectory/infrastructure/http/controllers/vfs/DownloadVFSArchiveController';

const listVFSDirectoryController = container.resolve(ListVFSDirectoryController);
const getVFSFileController = container.resolve(GetVFSFileController);
const uploadVFSFileController = container.resolve(UploadVFSFileController);
const deleteVFSFileController = container.resolve(DeleteVFSFileController);
const downloadVFSArchiveController = container.resolve(DownloadVFSArchiveController);

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(protect);


router.get('/:trajectoryId/archive', downloadVFSArchiveController.handle);
router.get('/:trajectoryId/files', getVFSFileController.handle);

// Standard VFS operations on root /:trajectoryId
router.route('/:trajectoryId')
    .get(listVFSDirectoryController.handle)
    .post(upload.single('file'), uploadVFSFileController.handle)
    .delete(deleteVFSFileController.handle);

export default router;
