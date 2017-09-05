/**
 * Created by Lookis on 04/09/2017.
 */
import { expect } from 'chai';
import WebSocket from 'ws';
import config from 'config';
import constants from '../src/constants.json';
import { redis } from '../src/redis';
import app from '../src/app';
import sign from './lib/sign';

describe('echo', () => {
  let client;
  let server;

  beforeEach(done => {
    server = app.listen(config.server.port, config.server.host, () => {
      client = new WebSocket(
        `ws://${config.server.host === '0.0.0.0' || config.server.host === '::'
          ? '127.0.0.1'
          : config.server.host}:${config.server.port}/connection`,
      );
      done();
    });
  });

  afterEach(done => {
    client.on('close', () => {
      server.close(() => {
        redis.flushdbAsync().then(() => {
          done();
        });
      });
    });
    client.close();
  });

  it('should echo payload', done => {
    const payload = {
      hello: Math.random().toString(),
    };
    client.once('message', msg => {
      client.on('message', msg1 => {
        expect(JSON.parse(msg1).payload).is.deep.equal(payload);
        done();
      });
      const message = JSON.parse(msg);
      if (message.code === constants.service.success) {
        client.send(
          JSON.stringify({
            token: message.msg,
            service: 'echo',
            payload,
          }),
        );
      }
    });
    client.on('open', () => {
      const message = {
        service: 'authentication',
        timestamp: new Date().getTime() / 1000,
        client: Object.keys(config.clients)[0],
        nonce: Math.random().toString(),
      };
      client.send(JSON.stringify(sign(message)));
    });
  });
});
