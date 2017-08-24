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
  router.post('/connection/:connection', (req, res) => {
    verifier(req.body)
      .then(() => {
        redis
          .publishAsync(
            `connection|${req.params.connection}`,
            JSON.stringify({
              client: req.body.client,
              payload: req.body.payload,
            }),
          )
          .then(received => {
            if (received === 0) {
              res.status(410);
            } else {
              res.status(200);
            }
            res.send();
          });
      })
      .catch(e => {
        res.status(400);
        res.json(e);
      });
  });

  return router;
};
