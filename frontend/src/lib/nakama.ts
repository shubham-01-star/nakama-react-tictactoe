import { Client } from '@heroiclabs/nakama-js';

const isProd = window.location.hostname !== '127.0.0.1' && window.location.hostname !== 'localhost';
const host = isProd ? "api-tictactoe.startup-lab.cloud" : "127.0.0.1";
export const USE_SSL = isProd ? true : false;
const port = isProd ? "443" : "7350";

export const client = new Client("defaultkey", host, port, USE_SSL);
