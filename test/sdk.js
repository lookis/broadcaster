/**
 * Created by Lookis on 05/09/2017.
 */
import { expect } from 'chai';
import config from 'config';
import { Server as SocketServer } from 'mock-socket';
import WebSocket from 'ws';
import sign from './lib/sign';
import { redis } from '../src/redis';
import app from '../src/app';
import sdk from '../src/public/js/sdk';

describe('sdk', () => {
  let server;
  let client;
  let mockServer;

  beforeEach(done => {
    sdk.config({
      reconnect: 0,
      hostname: `${config.server.host}:${config.server.port}`,
    });
    mockServer = new SocketServer(
      `ws://${config.server.host}:${config.server.port}/connection`,
    );
    server = app.listen(config.server.port, config.server.host, () => {
      mockServer.on('message', msg => {
        client.send(msg);
      });
      client = new WebSocket(
        `ws://${config.server.host === '0.0.0.0' || config.server.host === '::'
          ? '127.0.0.1'
          : config.server.host}:${config.server.port}/connection`,
      );
      const oldServer = mockServer;
      client.on('message', msg => {
        oldServer.send(msg);
      });
      client.on('close', () => {
        mockServer.close();
      });
      client.on('open', () => {
        done();
      });
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

  it('should return err if authenticate error', done => {
    const clientId = Object.keys(config.clients)[0];
    const conf = {
      timestamp: new Date().getTime() / 1000,
      client: clientId,
      // nonce: Math.random().toString(),
    };

    sdk.authenticate(sign(conf), (err, sender) => {
      expect(err).to.not.equal(null);
      expect(sender).to.equal(null);
      done();
    });
  });

  it('should return sender', done => {
    const clientId = Object.keys(config.clients)[0];
    const conf = {
      timestamp: new Date().getTime() / 1000,
      client: clientId,
      nonce: Math.random().toString(),
    };
    sdk.authenticate(sign(conf), (err, sender) => {
      expect(sender).to.not.equal(null);
      expect(err).to.equal(null);
      done();
    });
  });

  it('should send and receive message', done => {
    const clientId = Object.keys(config.clients)[0];
    const message = {
      hello: Math.random().toString(),
    };
    const conf = {
      timestamp: new Date().getTime() / 1000,
      client: clientId,
      nonce: Math.random().toString(),
    };
    sdk.authenticate(sign(conf), (err, sender) => {
      sender.onmessage(msg => {
        expect(msg).to.be.deep.equal(message);
        done();
      });
      sender.echo(message);
    });
  });

  it('should send and receive message after reconnect', done => {
    const clientId = Object.keys(config.clients)[0];
    const conf = {
      timestamp: new Date().getTime() / 1000,
      client: clientId,
      nonce: Math.random().toString(),
    };
    sdk.authenticate(sign(conf), (err, sender) => {
      sender.oncemessage(() => {
        // disconnect a connected connection
        mockServer.close({
          code: 1006,
        });
        // this because mock-socket error, closed server also send meesage
        client.removeAllListeners();
        const message = {
          hello: Math.random().toString(),
        };
        sender.onmessage(msg => {
          expect(msg).to.be.deep.equal(message);
          done();
        });
        // reconnect
        mockServer = new SocketServer(
          `ws://${config.server.host}:${config.server.port}/connection`,
        );
        mockServer.on('message', msg => {
          client.send(msg);
        });
        client.on('message', msg => {
          mockServer.send(msg);
        });
        client.on('close', () => {
          mockServer.close();
        });
        sender.echo(message);
      });
      sender.echo({
        hello: 'world',
      });
    });
  });
});
