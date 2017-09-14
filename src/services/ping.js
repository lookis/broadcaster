import { redis } from '../redis';

export default function(ws, client) {
  redis.publishAsync(
    `connection|${ws.id}`,
    JSON.stringify({
      client,
      type: 'ping',
      payload: 'pong',
    }),
  );
}
