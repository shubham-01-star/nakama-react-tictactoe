import { Client } from '@heroiclabs/nakama-js';

// Development config
const USE_SSL = false;
export const client = new Client("defaultkey", "localhost", "7350", USE_SSL);
