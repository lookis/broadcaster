/* eslint-disable no-param-reassign */
/**
 * Created by Lookis on 22/08/2017.
 */
import express from 'express';
import uuid from 'uuid/v1';
import service from '../services';
import { subscriber } from '../redis';

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
    });
    subscriber.subscribe(`connection|${ws.id}`);
  });
  return router;
};
