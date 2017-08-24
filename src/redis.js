/* eslint-disable global-require,import/no-extraneous-dependencies */
import config from 'config';
import bluebird from 'bluebird';
import redis from 'redis';

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

let client;
let subscriber;
if (config.util.getEnv('NODE_ENV') !== 'test') {
  client = redis.createClient(config.redis);
  subscriber = redis.createClient(config.redis);
} else {
  client = require('redis-js');
  subscriber = require('redis-js');
  bluebird.promisifyAll(client);
  bluebird.promisifyAll(subscriber);
}

client.on('error', err => console.log(err)); // eslint-disable-line no-console
subscriber.on('error', err => console.log(err)); // eslint-disable-line no-console

export { client as redis, subscriber };
