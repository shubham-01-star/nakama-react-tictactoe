import { Client } from '@heroiclabs/nakama-js';

// Development config
const USE_SSL = window.location.protocol === 'https:';
export const client = new Client("defaultkey", window.location.hostname, "7350", USE_SSL);
