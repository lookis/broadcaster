/**
 * Created by Lookis on 23/08/2017.
 */
import path from 'path';
import config from 'config';
import { redis } from '../redis';
import constants from '../constants.json';
import authentication from './authentication';

export default function(ws) {
  return function(_msg) {
    let msg;
    try {
      msg = JSON.parse(_msg);
    } catch (e) {
      ws.sendJson({
        code: constants.validation.errors.json,
        msg: `invalid json format`,
      });
      return;
    }
    if (msg.token) {
      redis
        .getAsync(`token|${ws.id}|${msg.token}`)
        .then(client => {
          if (client && config.clients[client]) {
            let service;
            try {
              // eslint-disable-next-line import/no-dynamic-require,global-require
              service = require(path.join(__dirname, `${msg.service}.js`))
                .default;
              service(ws, client, msg);
            } catch (e) {
              ws.sendJson({
                code: constants.service.errors.unknown,
                msg: 'unknown service',
              });
            }
          } else {
            ws.sendJson({
              code: constants.service.errors.token,
              msg: 'invalid token',
            });
          }
        })
        .catch(() => {
          ws.sendJson({
            code: constants.service.errors.unavailable,
            msg: 'service unavailable',
          });
        });
    } else if (msg.service && msg.service === 'authentication') {
      authentication(ws, msg);
    } else {
      ws.sendJson({
        code: constants.validation.errors.invalid,
        msg: 'invalid request',
      });
    }
  };
}
