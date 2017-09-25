/**
 * Created by Lookis on 24/08/2017.
 */
import querystring from 'querystring';
import config from 'config';
import md5 from 'md5';

function sign(msg) {
  const ordered = {};
  Object.keys(msg).sort().forEach(key => {
    if (msg[key] && key !== 'signature' && key !== 'service') {
      if (typeof msg[key] === 'object') {
        ordered[key] = JSON.stringify(msg[key]);
      } else {
        ordered[key] = msg[key];
      }
    }
  });
  const stringA = querystring.unescape(querystring.stringify(ordered));
  const stringSignTemp = `${stringA}&key=${config.clients[msg.client].secret}`;
  const signature = md5(stringSignTemp).toUpperCase();
  return Object.assign({}, msg, {
    signature,
  });
}

export default sign;
