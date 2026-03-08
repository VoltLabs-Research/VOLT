import { createService } from '@/app/core/http/utilities/create-service';
import clients from './clients';
import endpoints from './endpoints';

const service = createService({ clients }, endpoints);

export default service;
