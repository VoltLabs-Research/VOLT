import crudEndpoints from './crud';
import assetEndpoints from './assets';
import transferEndpoints from './transfer';
import fileEndpoints from './files';
import folderEndpoints from './folders';

const endpoints = {
    ...crudEndpoints,
    ...assetEndpoints,
    ...transferEndpoints,
    ...fileEndpoints,
    ...folderEndpoints
};

export default endpoints;
