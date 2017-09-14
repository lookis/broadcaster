/**
 * Created by Lookis on 24/08/2017.
 */
import { expect } from 'chai';
import WebSocket from 'ws';
import config from 'config';
import constants from '../src/constants.json';
import { redis } from '../src/redis';
import app from '../src/app';
import sign from './lib/sign';

// expect(err).to.be.null;
// expect(res).to.have.status(200);
// expect(res.body).to.be.deep.equal({ data: { me: null } });

describe('service', () => {
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

  it('should return token error if not a good one', done => {
    client.on('message', msg => {
      const message = JSON.parse(msg);
      expect(message.code).to.be.equal(constants.service.errors.token);
      done();
    });
    client.on('open', () => {
      client.send('{"token": "not exists token"}');
    });
  });

  it('should return unknown service if service goes wrong', done => {
    client.once('message', msg => {
      const message = JSON.parse(msg);
      expect(message.payload.code).to.be.equal(constants.service.success);
      const token = message.payload.msg;
      client.on('message', msg2 => {
        const message2 = JSON.parse(msg2);
        expect(message2.code).to.be.equal(constants.service.errors.unknown);
        done();
      });
      client.send(
        JSON.stringify({
          token,
          service: 'unknown',
        }),
      );
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
