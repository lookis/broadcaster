/**
 * Created by Lookis on 23/08/2017.
 */
import querystring from 'querystring';
import config from 'config';
import md5 from 'md5';
import constants from '../constants.json';
import { redis } from '../redis';

function sign(msg, secret) {
  const ordered = {};
  ['timestamp', 'client', 'nonce'].forEach(key => {
    if (typeof msg[key] === 'object') {
      ordered[key] = JSON.stringify(msg[key]);
    } else {
      ordered[key] = msg[key];
    }
  });
  const stringA = querystring.unescape(querystring.stringify(ordered));
  const stringSignTemp = `${stringA}&key=${secret}`;
  return md5(stringSignTemp).toUpperCase();
}

function verifier(msg) {
  return new Promise((resolve, reject) => {
    if (!msg.client) {
      reject({
        code: constants.validation.errors.missing,
        msg: `client is required`,
      });
      return;
    }
    // timestamp
    if (!msg.timestamp) {
      reject({
        code: constants.validation.errors.missing,
        client: msg.client,
        msg: `timestamp is required`,
      });
      return;
    }
    const now = parseInt(new Date().getTime() / 1000, 10);
    if (Math.abs(now - msg.timestamp) > 60 * 5) {
      // 5 minutes
      reject({
        code: constants.authentication.errors.timestamp,
        client: msg.client,
        msg: `invalid timestamp`,
      });
      return;
    }

    if (!config.clients[msg.client]) {
      reject({
        code: constants.authentication.errors.client,
        client: msg.client,
        msg: `unknown client`,
      });
      return;
    }

    if (!msg.nonce) {
      reject({
        code: constants.validation.errors.missing,
        client: msg.client,
        msg: `nonce is required`,
      });
      return;
    }
    redis.existsAsync(`nonce|${msg.client}|${msg.nonce}`).then(exists => {
      if (exists) {
        reject({
          code: constants.authentication.errors.nonce,
          client: msg.client,
          msg: `duplicated nonce`,
        });
        return;
      }
      redis
        .setexAsync(`nonce|${msg.client}|${msg.nonce}`, 60 * 5, true)
        .then(() => {
          const client = config.clients[msg.client];
          const signature = sign(msg, client.secret);
          if (signature !== msg.signature) {
            reject({
              code: constants.authentication.errors.signature,
              client: msg.client,
              msg: `invalid signature`,
            });
            return;
          }
          resolve();
        });
    });
  });
}

export default verifier;
