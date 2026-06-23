import { MasterId } from './masters'

export interface ServerMasterConfig {
  id: MasterId
  name: string
  avatar: string
}

export function getServerMasterConfig(masterId: MasterId): ServerMasterConfig {
  return {
    id: masterId,
    name: masterId === 'olga' ? 'Olga' : 'Yuliia',
    avatar: masterId === 'olga' ? '/photo_master_olga.png' : '/photo_master_yuliia.png',
  }
}
