'use strict';

import cons from 'consolidate';
import express from 'express';
import http from 'http';
import path from 'path';

import manifest from '../../package.json';
import routes from './routes.js';

let app = express();
let publicPath = path.join(__dirname, '../../public');

app.set('port', process.env.PORT || 8877);
app.set('host', process.env.VIRTUAL_HOST || `http://localhost:${app.get('port')}/`);
app.engine('html', cons.handlebars);
app.set('view engine', 'html');
app.set('views', path.join(__dirname, '../templates'));

app.use(express.static(publicPath));
app.use('/', routes);

http.createServer(app).listen(app.get('port'));
console.log(`${manifest.name} ${manifest.version} up and running on ${app.get('port')}`);
