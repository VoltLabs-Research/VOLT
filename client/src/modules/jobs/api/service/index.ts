import clients from './client';
import endpoints from './endpoints';
import { createService } from '@/app/core/http/utilities/create-service';

const service = createService({ clients }, endpoints);

export default service;
