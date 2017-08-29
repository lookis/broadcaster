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

// expect(err).to.be.null;
// expect(res).to.have.status(200);
// expect(res.body).to.be.deep.equal({ data: { me: null } });

describe('connection', () => {
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
    if (client.readyState === client.CLOSED) {
      server.close(() => {
        redis.flushdbAsync().then(() => {
          done();
        });
      });
    } else {
      client.on('close', () => {
        server.close(() => {
          redis.flushdbAsync().then(() => {
            done();
          });
        });
      });
      client.close();
    }
  });

  it('should open and connected', done => {
    client.on('open', () => {
      done();
    });
  });

  it('should return invalid json format if not a json', done => {
    client.on('message', msg => {
      const message = JSON.parse(msg);
      expect(message.code).to.be.equal(constants.validation.errors.json);
      done();
    });
    client.on('open', () => {
      client.send('|notajson|');
    });
  });

  it('should return invalid request if no token and service', done => {
    client.on('message', msg => {
      const message = JSON.parse(msg);
      expect(message.code).to.be.equal(constants.validation.errors.invalid);
      done();
    });
    client.on('open', () => {
      client.send('{}');
    });
  });

  it('should send delete if websocket disconnect', done => {
    client.once('message', msg => {
      const message = JSON.parse(msg);
      expect(message.code).to.be.equal(constants.service.success);
      const clientId = Object.keys(config.clients)[0];
      const clientInfo = config.clients[clientId];
      const url = new URL(clientInfo.callback);
      const callback = nock(url.origin)
        .delete(uri => uri.startsWith(url.pathname))
        .reply(200);
      callback.on('replied', () => {
        done();
      });
      client.close();
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
