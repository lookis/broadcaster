/* eslint-disable no-unused-expressions,no-undef,no-param-reassign,global-require,import/no-extraneous-dependencies */
/**
 * Created by Lookis on 02/09/2017.
 */

const Sender = function(client, token, collector) {
  this.client = client; // websocket
  this.token = token; // token
  this.collector = collector;
};

Sender.prototype.doSend = function(msg, service) {
  this.client().then(c => {
    c.send(
      JSON.stringify({
        token: this.token,
        service,
        payload: msg,
      }),
    );
  });
};

Sender.prototype.send = function(msg) {
  this.doSend(msg, 'forward');
};

Sender.prototype.onmessage = function(callback) {
  const proxy = function(msg) {
    if (msg.type === 'forward') {
      callback(msg.payload);
    }
  };
  this.collector(proxy);
};

Sender.prototype.oncemessage = function(callback) {
  const onceProxy = function(msg, remover) {
    if (msg.type === 'forward') {
      remover();
      callback(msg.payload);
    }
  };
  this.collector(onceProxy);
};

const Sdk = () => {
  let conf = {
    ping: 5000,
    reconnect: 500,
    hostname: this.location ? this.location.host : '127.0.0.1:8080',
  };
  let SocketImpl;
  try {
    SocketImpl = require('mock-socket').WebSocket;
  } catch (e) {
    SocketImpl = WebSocket;
  }
  const aliveTokens = [];
  const messageListener = {};
  let client;
  let heartbeatTimer;
  const initializeClient = _client => {
    _client.onclose = e => {
      if (e.code !== 1000) {
        const reconnect = () => {
          setTimeout(() => {
            clearInterval(heartbeatTimer);
            client = new Promise(resolve => {
              const socks = new SocketImpl(`ws://${conf.hostname}/connection`);
              socks.onopen = () => {
                aliveTokens.forEach(token => {
                  socks.send(
                    JSON.stringify({
                      token,
                      service: 'ping',
                      payload: {},
                    }),
                  );
                });
                resolve(socks);
              };
              socks.onclose = ec => {
                if (ec.code !== 1000) {
                  reconnect();
                }
              };
            });
            client.then(initializeClient);
          }, conf.reconnect);
        };
        reconnect();
      } else {
        client = null;
      }
    };

    _client.onmessage = e => {
      const message = JSON.parse(e.data);
      messageListener[message.client] &&
        messageListener[message.client].forEach(listener => {
          try {
            listener(e);
            // eslint-disable-next-line no-empty
          } catch (ex) {}
        });
    };

    heartbeatTimer = setInterval(() => {
      aliveTokens.forEach(token => {
        _client.send(
          JSON.stringify({
            token,
            service: 'ping',
            payload: {},
          }),
        );
      });
    }, conf.ping);
  };
  const getClient = function() {
    return client;
  };

  const config = function(_conf) {
    conf = Object.assign(conf, _conf);
  };

  const authenticate = function(clientConf, callback) {
    const self = this;
    function once(e) {
      const index = messageListener[clientConf.client].indexOf(once);
      if (index > -1) {
        messageListener[clientConf.client].splice(index, 1);
      }
      if (e.data) {
        const message = JSON.parse(e.data);
        if (
          message.type === 'authentication' &&
          message.payload.code === '000000'
        ) {
          aliveTokens.push(message.payload.msg);
          const sender = new Sender(
            getClient.bind(self),
            message.payload.msg,
            onMessage => {
              const decoder = ev => {
                onMessage(
                  // parsed message
                  JSON.parse(ev.data),
                  // remover for once message
                  () => {
                    const proxyIndex = messageListener[
                      clientConf.client
                    ].indexOf(decoder);
                    if (proxyIndex > -1) {
                      messageListener[clientConf.client].splice(index, 1);
                    }
                  },
                );
              };
              messageListener[clientConf.client].push(decoder);
            },
          );
          callback(null, sender);
        } else {
          callback(message, null);
        }
      } else {
        callback(e, null);
      }
    }

    if (!clientConf.client) {
      callback('client is missing', null);
    } else {
      if (!client) {
        client = new Promise(resolve => {
          const socks = new SocketImpl(`ws://${conf.hostname}/connection`);
          socks.onopen = () => {
            resolve(socks);
          };
        });
        client.then(initializeClient);
      }
      messageListener[clientConf.client] =
        messageListener[clientConf.client] || [];
      messageListener[clientConf.client].push(once);
      const message = {
        service: 'authentication',
        timestamp: clientConf.timestamp,
        client: clientConf.client,
        nonce: clientConf.nonce,
        signature: clientConf.signature,
      };
      client.then(c => {
        c.send(JSON.stringify(message));
      });
    }
  };

  return {
    config,
    authenticate,
  };
};

((root, factory) => {
  // AMD. Register as an anonymous module.
  // eslint-disable-next-line no-undef
  if (typeof define === 'function' && define.amd) {
    // eslint-disable-next-line no-undef
    define('broadcaster', [], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node. Does not work with strict CommonJS, but
    // only CommonJS-like environments that support module.exports,
    // like Node.
    // eslint-disable-next-line global-require,import/no-extraneous-dependencies
    module.exports = factory();
  } else {
    // Browser globals (root is window)
    // eslint-disable-next-line no-param-reassign
    root.broadcaster = factory();
  }
})(this, Sdk);
