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

describe('authentication', () => {
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

  describe('timestamp', () => {
    it('should return report timestamp missing if missing', done => {
      client.on('message', msg => {
        const message = JSON.parse(msg);
        expect(message.code).to.be.equal(constants.validation.errors.missing);
        expect(message.msg).to.include('timestamp');
        done();
      });
      client.on('open', () => {
        client.send('{"service": "authentication"}');
      });
    });

    it('should return error if timestamp is 5 minutes before', done => {
      client.on('message', msg => {
        const message = JSON.parse(msg);
        expect(message.code).to.be.equal(
          constants.authentication.errors.timestamp,
        );
        done();
      });
      client.on('open', () => {
        client.send(
          JSON.stringify({
            service: 'authentication',
            timestamp: new Date().getTime() / 1000 - 5 * 60 - 1,
          }),
        );
      });
    });

    it('should return error if timestamp is 5 minutes after', done => {
      client.on('message', msg => {
        const message = JSON.parse(msg);
        expect(message.code).to.be.equal(
          constants.authentication.errors.timestamp,
        );
        done();
      });
      client.on('open', () => {
        client.send(
          JSON.stringify({
            service: 'authentication',
            timestamp: new Date().getTime() / 1000 + 5 * 60 + 1,
          }),
        );
      });
    });
  });

  describe('client', () => {
    it('should return report client missing if missing', done => {
      client.on('message', msg => {
        const message = JSON.parse(msg);
        expect(message.code).to.be.equal(constants.validation.errors.missing);
        expect(message.msg).to.include('client');
        done();
      });
      client.on('open', () => {
        client.send(
          JSON.stringify({
            service: 'authentication',
            timestamp: new Date().getTime() / 1000,
          }),
        );
      });
    });
    it('should return report client error', done => {
      client.on('message', msg => {
        const message = JSON.parse(msg);
        expect(message.code).to.be.equal(
          constants.authentication.errors.client,
        );
        expect(message.msg).to.include('client');
        done();
      });
      client.on('open', () => {
        client.send(
          JSON.stringify({
            service: 'authentication',
            timestamp: new Date().getTime() / 1000,
            client: Math.random().toString(),
          }),
        );
      });
    });
  });

  describe('nonce', () => {
    it('should report nonce missing if missing', done => {
      client.on('message', msg => {
        const message = JSON.parse(msg);
        expect(message.code).to.be.equal(constants.validation.errors.missing);
        expect(message.msg).to.include('nonce');
        done();
      });
      client.on('open', () => {
        client.send(
          JSON.stringify({
            service: 'authentication',
            timestamp: new Date().getTime() / 1000,
            client: Object.keys(config.clients)[0],
          }),
        );
      });
    });

    it('should report nonce error if use same nonce more than one time', done => {
      const nonce = Math.random().toString();
      let requestTimes = 0;
      client.on('message', msg => {
        const message = JSON.parse(msg);
        if (requestTimes === 1) {
          expect(message.code).to.be.equal(
            constants.authentication.errors.nonce,
          );
          done();
        } else {
          requestTimes += 1;
          client.send(
            JSON.stringify({
              service: 'authentication',
              timestamp: new Date().getTime() / 1000,
              client: Object.keys(config.clients)[0],
              nonce,
            }),
          );
        }
      });
      client.on('open', () => {
        client.send(
          JSON.stringify({
            service: 'authentication',
            timestamp: new Date().getTime() / 1000,
            client: Object.keys(config.clients)[0],
            nonce,
          }),
        );
      });
    });
  });

  describe('signature', () => {
    it('should report error', done => {
      client.on('message', msg => {
        const message = JSON.parse(msg);
        expect(message.code).to.be.equal(
          constants.authentication.errors.signature,
        );
        done();
      });
      client.on('open', () => {
        client.send(
          JSON.stringify({
            service: 'authentication',
            timestamp: new Date().getTime() / 1000,
            client: Object.keys(config.clients)[0],
            nonce: Math.random().toString(),
          }),
        );
      });
    });

    it('should pass if everything is good', done => {
      client.on('message', msg => {
        const message = JSON.parse(msg);
        expect(message.code).to.be.equal(constants.service.success);
        done();
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

    it('should make a call to callback', done => {
      const clientId = Object.keys(config.clients)[0];
      const clientInfo = config.clients[clientId];
      const url = new URL(clientInfo.callback);
      const callback = nock(url.origin)
        .put(uri => uri.startsWith(url.pathname))
        .reply(400);
      client.on('message', () => {
        callback.done();
        done();
      });
      client.on('open', () => {
        const message = {
          service: 'authentication',
          timestamp: new Date().getTime() / 1000,
          client: clientId,
          nonce: Math.random().toString(),
        };
        client.send(JSON.stringify(sign(message)));
      });
    });
  });

  it('should return unknown service if service goes wrong', done => {
    client.on('message', msg => {
      const message = JSON.parse(msg);
      expect(message.code).to.be.equal(constants.service.errors.unknown);
      done();
    });
    client.on('open', () => {
      const token = Math.random().toString();
      redis
        .setexAsync(`token|${token}`, 60, Object.keys(config.clients)[0])
        .then(() => {
          client.send(
            JSON.stringify({
              token,
              service: 'unknown',
            }),
          );
        });
    });
  });
});
