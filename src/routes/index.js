/**
 * Created by Lookis on 22/08/2017.
 */
import express from 'express';
import fs from 'fs';
import path from 'path';


module.exports = function(globalWsInstance){
  const router = express.Router();
  fs.readdirSync(__dirname).forEach(file => {
    if (file === 'index.js') {
      return;
    }
    if (file.endsWith('.js')) {
      // eslint-disable-next-line global-require,import/no-dynamic-require
      router.use(require(path.join(__dirname, file))(globalWsInstance));
    }
  });
  return router;
};
