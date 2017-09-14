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
      redis
        .setexAsync(`token:connection|${token}`, 60 * 60 * 24, ws.id)
        .then(() => {
          redis
            .setexAsync(`token:client|${token}`, 60 * 60 * 24, msg.client)
            .then(() => {
              fetch(`${config.clients[msg.client].callback}/${token}`, {
                headers: {
                  Accept: 'application/json',
                  'user-agent': 'Broadcaster',
                },
                method: 'PUT',
              })
                .catch(() => {})
                .then(() => {
                  ws.sendJson({
                    client: msg.client,
                    type: 'authentication',
                    payload: {
                      code: constants.service.success,
                      msg: token,
                    },
                  });
                });
            });
        });
    })
    .catch(e => {
      ws.sendJson(e);
    });
}
