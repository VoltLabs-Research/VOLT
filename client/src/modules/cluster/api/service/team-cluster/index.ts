import { createService } from '@/app/core/http/utilities/create-service';
import client from './client';
import endpoints from './endpoints';

export const teamClusterService = createService({ clients: client }, endpoints);
