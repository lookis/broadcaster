/**
 * Created by Lookis on 22/08/2017.
 */
import express from 'express';
import fs from 'fs';
import path from 'path';
// import home from './home';

const router = express.Router();
fs.readdirSync(__dirname).forEach((file) => {
  if (file === 'index.js' || file === 'home.js') {
    return;
  }
  router.use(require(path.join(__dirname, file)));
});

// router.use(home);

module.exports = router;
