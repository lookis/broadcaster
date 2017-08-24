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
// expect(err).to.be.null;
// expect(res).to.have.status(200);
// expect(res.body).to.be.deep.equal({ data: { me: null } });

describe('upstream', () => {
  let client;
  let server;
  let token;
  let connection;

  beforeEach(done => {
    server = app.listen(config.server.port, config.server.host, () => {
      const clientId = Object.keys(config.clients)[0];
      const clientInfo = config.clients[clientId];
      const url = new URL(clientInfo.callback);
      nock(url.origin)
        .put(uri => {
          const parts = uri.split('/');
          connection = parts[parts.length - 1];
          return uri.startsWith(url.pathname);
        })
        .reply(200);

      client = new WebSocket(
        `ws://${config.server.host === '0.0.0.0' || config.server.host === '::'
          ? '127.0.0.1'
          : config.server.host}:${config.server.port}/connection`,
      );

      client.once('message', msg => {
        const message = JSON.parse(msg);
        if (message.code === constants.service.success) {
          token = message.msg;
          done();
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

  it('should reject by 400', done => {
    chai
      .request(app)
      .post('/connection/notexist')
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
      .post('/connection/notexist')
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
    }
    client.on('message', _msg => {
      const msg = JSON.parse(_msg);
      expect(msg.client).to.be.equal(Object.keys(config.clients)[0]);
      expect(msg.payload).to.be.deep.equal(message);
      done();
    })
    chai
      .request(app)
      .post(`/connection/${connection}`)
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
