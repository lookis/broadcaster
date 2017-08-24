/**
   * Created by Lookis on 23/08/2017.
   */
import fetch from 'node-fetch';
import config from 'config';
import uuid from 'uuid/v1';
import constants from '../constants.json';
import { redis } from '../redis';

import verifier from '../lib/signature';

export default function(ws, msg) {
  verifier(msg)
    .then(() => {
      const token = uuid();
      redis.setexAsync(`token|${token}`, 60 * 60 * 24, msg.client).then(() => {
        fetch(`${config.clients[msg.client].callback}/${ws.id}`, {
          headers: {
            Accept: 'application/json',
            'user-agent': 'GoBroadcaster',
          },
          method: 'PUT',
        })
          .catch(() => {})
          .then(() => {
            ws.sendJson({
              code: constants.service.success,
              msg: token,
            });
          });
      });
    })
    .catch(e => {
      ws.sendJson(e);
    });
}
