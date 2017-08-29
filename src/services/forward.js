/**
 * Created by Lookis on 23/08/2017.
 */
import config from 'config';
import fetch from 'node-fetch';

export default function(ws, client, msg) {
  fetch(`${config.clients[client].callback}/${ws.id}`, {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'user-agent': 'Broadcaster',
    },
    method: 'POST',
    body: JSON.stringify(msg.payload),
  }).catch(() => {});
}
