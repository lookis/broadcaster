/* eslint-disable no-param-reassign */
/**
 * Created by Lookis on 22/08/2017.
 */
import express from 'express';
import uuid from 'uuid/v1';
import config from 'config';
import fetch from 'node-fetch';
import service from '../services';
import { subscriber, redis } from '../redis';

module.exports = function() {
  const router = express.Router();

  router.ws('/connection', ws => {
    ws.id = uuid();
    ws.sendJson = function(object) {
      ws.send(JSON.stringify(object));
    };
    ws.on('message', service(ws));
    ws.on('close', () => {
      subscriber.unsubscribe(`connection|${ws.id}`);
      redis.keysAsync(`token|${ws.id}|*`).then(keys => {
        keys.forEach(key => {
          redis.getAsync(key).then(client => {
            if (client && config.clients[client]) {
              fetch(`${config.clients[client].callback}/${ws.id}`, {
                headers: {
                  Accept: 'application/json',
                  'Content-Type': 'application/json',
                  'user-agent': 'Broadcaster',
                },
                method: 'DELETE',
              }).catch(() => {});
            }
          });
        });
      });
    });
    subscriber.subscribe(`connection|${ws.id}`);
  });
  return router;
};
