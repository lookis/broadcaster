/**
 * Created by Lookis on 03/09/2017.
 */
import { redis } from '../redis';

export default function(ws, client, msg) {
  redis.publishAsync(
    `connection|${ws.id}`,
    JSON.stringify({
      client,
      payload: msg.payload,
    }),
  );
}
