/**
 * Created by Lookis on 05/09/2017.
 */
import chai, { expect } from 'chai';
import chaiHttp from 'chai-http';
import config from 'config';
import { Server as SocketServer } from 'mock-socket';
import WebSocket from 'ws';
import nock from 'nock';
import { URL } from 'url';
import sign from './lib/sign';
import { redis } from '../src/redis';
import app from '../src/app';
import sdk from '../src/public/js/sdk';

chai.use(chaiHttp);

describe('sdk', () => {
  let server;
  let client;
  let mockServer;

  const echoServer = () => {
    const clientId = Object.keys(config.clients)[0];
    const clientInfo = config.clients[clientId];
    const url = new URL(clientInfo.callback);
    nock(url.origin)
      .persist()
      .post(uri => uri.startsWith(url.pathname), () => true)
      .reply((uri, body, cb) => {
        chai
          .request(app)
          .post(`/client/${uri.split('/').pop()}`)
          .send(
            sign({
              client: Object.keys(config.clients)[0],
              timestamp: new Date().getTime() / 1000,
              nonce: Math.random().toString(),
              payload: body,
            }),
          )
          .end((err, res) => {
            expect(res).to.have.status(200);
            cb(null, [200, '']);
          });
      });
  };

  beforeEach(done => {
    echoServer();
    sdk.config({
      reconnect: 0,
      hostname: `${config.server.host}:${config.server.port}`,
    });
    mockServer = new SocketServer(
      `ws://${config.server.host}:${config.server.port}/connection`,
    );
    server = app.listen(config.server.port, config.server.host, () => {
      client = new WebSocket(
        `ws://${config.server.host === '0.0.0.0' || config.server.host === '::'
          ? '127.0.0.1'
          : config.server.host}:${config.server.port}/connection`,
      );
      mockServer.on('message', msg => {
        client.send(msg);
      });
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
    nock.cleanAll();
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
      sender.send(message);
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
        sender.send(message);
      });
      sender.send({
        hello: 'world',
      });
    });
  });

  it('should received a ping message after reconnect', done => {
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
        // reconnect
        mockServer = new SocketServer(
          `ws://${config.server.host}:${config.server.port}/connection`,
        );
        mockServer.on('message', msg => {
          if (sender.token === JSON.parse(msg).token) {
            expect(JSON.parse(msg).service).to.be.equal('ping');
            done();
          }
        });
      });
      sender.send({
        hello: 'world',
      });
    });
  });
});
