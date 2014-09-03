var express = require('express');
var favicon = require('serve-favicon');
var path = require('path');
var http = require('http');

var config = require('./config');
var router = require('./lib/router');
var crawler = require('./lib/crawler');

var app = express();
global.config = config;

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(favicon('favicon.ico'));
app.use(express.static(path.join(__dirname, 'public')));

app.locals.config = config;
app.locals.isActive = function isActive(url, link) {
  if (link == '/' && url != '/') return "";
  return url.indexOf(link) === 0 ? "active" : "";
};

app.use(function (req, res, next) {
  res.locals.url = req.url;
  next();
});
app.use('/', router);

app.use(function (req, res, next) {
  res.status(404).render('error');
});

app.listen(process.env.PORT || config.port);
crawler.run();
