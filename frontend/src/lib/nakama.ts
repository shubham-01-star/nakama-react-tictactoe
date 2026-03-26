import { Client } from '@heroiclabs/nakama-js';

const isProd = window.location.hostname !== '127.0.0.1' && window.location.hostname !== 'localhost';
const host = isProd ? "api-tictactoe.startup-lab.cloud" : window.location.hostname;
const USE_SSL = window.location.protocol === 'https:';
const port = isProd ? (USE_SSL ? "443" : "80") : "7350";

export const client = new Client("defaultkey", host, port, USE_SSL);
