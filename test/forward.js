/**
 * Created by Lookis on 24/08/2017.
 */
import { expect } from 'chai';
import WebSocket from 'ws';
import config from 'config';
import nock from 'nock';
import { URL } from 'url';
import constants from '../src/constants.json';
import { redis } from '../src/redis';
import app from '../src/app';
import sign from './lib/sign';

describe('forward', () => {
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

  it('should forward downstream', done => {
    const payload = {
      hello: Math.random().toString(),
    };
    client.on('message', msg => {
      const message = JSON.parse(msg);
      if (message.payload.code === constants.service.success) {
        const clientId = Object.keys(config.clients)[0];
        const clientInfo = config.clients[clientId];
        const url = new URL(clientInfo.callback);
        const callback = nock(url.origin)
          .post(
            uri => uri.startsWith(url.pathname),
            body => {
              expect(body).to.be.deep.equal(payload);
              return true;
            },
          )
          .reply(200);
        callback.on('replied', () => {
          done();
        });
        client.send(
          JSON.stringify({
            token: message.payload.msg,
            service: 'forward',
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

  it('should forward downstream even after reconnect', done => {
    const payload = {
      hello: Math.random().toString(),
    };
    client.on('message', msg => {
      const message = JSON.parse(msg);
      if (message.payload.code === constants.service.success) {
        client.close();
        client = new WebSocket(
          `ws://${config.server.host === '0.0.0.0' ||
          config.server.host === '::'
            ? '127.0.0.1'
            : config.server.host}:${config.server.port}/connection`,
        );

        const clientId = Object.keys(config.clients)[0];
        const clientInfo = config.clients[clientId];
        const url = new URL(clientInfo.callback);
        const callback = nock(url.origin)
          .post(
            uri => uri.startsWith(url.pathname),
            body => {
              expect(body).to.be.deep.equal(payload);
              return true;
            },
          )
          .reply(200);
        callback.on('replied', () => {
          done();
        });
        client.on('open', () => {
          client.send(
            JSON.stringify({
              token: message.payload.msg,
              service: 'forward',
              payload,
            }),
          );
        });
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
