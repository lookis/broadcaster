import express from 'express';
import path from 'path';
import compression from 'compression';
import bodyParser from 'body-parser';
import PrettyError from 'pretty-error';
import expressWs from 'express-ws';

const app = express();
const wsInstance = expressWs(app);

app.set('trust proxy', 'loopback');

app.use(compression());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(require('./routes')(wsInstance));

app.use(express.static(path.join(__dirname, 'public')));

const pe = new PrettyError();
pe.skipNodeFiles();
pe.skipPackage('express');

app.use((err, req, res, next) => {
  process.stderr.write(pe.render(err));
  next();
});

export default app;
