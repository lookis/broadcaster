/**
 * Created by Lookis on 24/08/2017.
 */
import chai, { expect } from 'chai';
import chaiHttp from 'chai-http';
import WebSocket from 'ws';
import config from 'config';
import nock from 'nock';
import { URL } from 'url';
import constants from '../src/constants.json';
import { redis } from '../src/redis';
import app from '../src/app';
import sign from './lib/sign';

chai.use(chaiHttp);

describe('upstream', () => {
  const clients = [];
  // let client;
  let server;
  let token;

  const getClient = authenticated => {
    const client = new WebSocket(
      `ws://${config.server.host === '0.0.0.0' || config.server.host === '::'
        ? '127.0.0.1'
        : config.server.host}:${config.server.port}/connection`,
    );
    if (authenticated) {
      client.once('message', msg => {
        const message = JSON.parse(msg);
        if (message.payload.code === constants.service.success) {
          token = message.payload.msg;
          authenticated();
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
    }
    clients.push(client);
    return client;
  };

  beforeEach(done => {
    server = app.listen(config.server.port, config.server.host, () => {
      const clientId = Object.keys(config.clients)[0];
      const clientInfo = config.clients[clientId];
      const url = new URL(clientInfo.callback);
      nock(url.origin)
        .put(uri => {
          const parts = uri.split('/');
          token = parts[parts.length - 1];
          return uri.startsWith(url.pathname);
        })
        .reply(200);
      done();
    });
  });

  afterEach(done => {
    clients.forEach(client => {
      client.close();
    });
    server.close(() => {
      redis.flushdbAsync().then(() => {
        done();
      });
    });
  });

  it('should reject by 400', done => {
    chai
      .request(app)
      .post('/client/notexist')
      .send(
        sign({
          client: Object.keys(config.clients)[0],
          nonce: Math.random().toString(),
          payload: {
            hello: 'world',
          },
        }),
      )
      .end((err, res) => {
        expect(res).to.have.status(400);
        done();
      });
  });

  it('should reject by 410', done => {
    chai
      .request(app)
      .post('/client/notexist')
      .send(
        sign({
          client: Object.keys(config.clients)[0],
          timestamp: new Date().getTime() / 1000,
          nonce: Math.random().toString(),
          payload: {
            hello: 'world',
          },
        }),
      )
      .end((err, res) => {
        expect(res).to.have.status(410);
        done();
      });
  });

  it('should send message successful', done => {
    const message = {
      hello: 'world',
    };
    const client = getClient(() => {
      client.on('message', _msg => {
        const msg = JSON.parse(_msg);
        expect(msg.client).to.be.equal(Object.keys(config.clients)[0]);
        expect(msg.payload).to.be.deep.equal(message);
        done();
      });
      chai
        .request(app)
        .post(`/client/${token}`)
        .send(
          sign({
            client: Object.keys(config.clients)[0],
            timestamp: new Date().getTime() / 1000,
            nonce: Math.random().toString(),
            payload: message,
          }),
        )
        .end((err, res) => {
          expect(res).to.have.status(200);
        });
    });
  });

  it('should send message successful after reconnect', done => {
    const message = {
      hello: 'world',
    };
    const client = getClient(() => {
      client.once('message', _msg => {
        const clientMsg = JSON.parse(_msg);
        expect(clientMsg.client).to.be.equal(Object.keys(config.clients)[0]);
        expect(clientMsg.payload).to.be.deep.equal(message);
        client.close();
        const newClient = getClient();
        // ping
        newClient.once('message', pong => {
          expect(JSON.parse(pong).payload).to.be.equal('pong');
          // real message;
          newClient.on('message', __msg => {
            const msg = JSON.parse(__msg);
            expect(msg.client).to.be.equal(Object.keys(config.clients)[0]);
            expect(msg.payload).to.be.deep.equal(message);
            done();
          });
          chai
            .request(app)
            .post(`/client/${token}`)
            .send(
              sign({
                client: Object.keys(config.clients)[0],
                timestamp: new Date().getTime() / 1000,
                nonce: Math.random().toString(),
                payload: message,
              }),
            )
            .end((err, res) => {
              expect(res).to.have.status(200);
            });
        });
        newClient.on('open', () => {
          chai
            .request(app)
            .post(`/client/${token}`)
            .send(
              sign({
                client: Object.keys(config.clients)[0],
                timestamp: new Date().getTime() / 1000,
                nonce: Math.random().toString(),
                payload: message,
              }),
            )
            .end((err, res) => {
              expect(res).to.have.status(410);
              newClient.send(
                JSON.stringify({
                  token,
                  service: 'ping',
                }),
              );
            });
        });
      });
      chai
        .request(app)
        .post(`/client/${token}`)
        .send(
          sign({
            client: Object.keys(config.clients)[0],
            timestamp: new Date().getTime() / 1000,
            nonce: Math.random().toString(),
            payload: message,
          }),
        )
        .end((err, res) => {
          expect(res).to.have.status(200);
        });
    });
  });
});
