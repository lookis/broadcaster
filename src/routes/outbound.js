/**
 * Created by Lookis on 22/08/2017.
 */
import express from 'express';
import { redis, subscriber } from '../redis';
import verifier from '../lib/signature';

module.exports = function(globalWsInstance) {
  subscriber.on('message', (channel, message) => {
    const clientId = channel.split('|')[1];
    globalWsInstance.getWss().clients.forEach(client => {
      if (client.id === clientId) {
        client.sendJson(JSON.parse(message));
      }
    });
  });

  const router = express.Router();
  router.post('/clients', (req, res) => {
    const { client, payload, tokens } = req.body;
    const goneTokens = [];
    verifier(req.body)
      .then(() => {
        const promises = [];
        tokens.forEach(token => {
          promises.push(
            redis.getAsync(`token:connection|${token}`).then(connection => {
              if (!connection) {
                return goneTokens.push(token);
              }
              return redis.publishAsync(
                `connection|${connection}`,
                JSON.stringify({
                  client,
                  type: 'forward',
                  payload,
                }),
              );
            }),
          );
        });
        Promise.all(promises).then(() => {
          res.status(200);
          res.json(goneTokens);
        });
      })
      .catch(e => {
        res.status(400);
        res.json(e);
      });
  });

  router.post('/client/:token', (req, res) => {
    verifier(req.body)
      .then(() => {
        redis
          .getAsync(`token:connection|${req.params.token}`)
          .then(connection => {
            if (!connection) {
              res.status(410);
              res.send();
            } else {
              redis
                .publishAsync(
                  `connection|${connection}`,
                  JSON.stringify({
                    client: req.body.client,
                    type: 'forward',
                    payload: req.body.payload,
                  }),
                )
                .then(received => {
                  if (received === 0) {
                    res.status(408);
                  } else {
                    res.status(200);
                  }
                  res.send();
                });
            }
          });
      })
      .catch(e => {
        res.status(400);
        res.json(e);
      });
  });

  return router;
};
