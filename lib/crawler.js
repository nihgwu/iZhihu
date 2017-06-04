var request = require('request');
var fs = require('fs');
var ejs = require('ejs');
var pouchdb = require('pouchdb');
var moment = require('moment');
var images = require('images');
var uploader = require('./uploader');
var log = require('util').log;

var initiated = false;
var latest = hot = sections = {};
var endDate = '20170530'; // '20130520'
global.db = new pouchdb('db');
global.latestDate = '';

function mosaic(json) {
  log("====== mosaic: " + json.date + " ======");
  var size = Math.floor(Math.sqrt(json.news.length));
  if (size > 6)size = 6;
  var length = size * size;
  var width = 300 / size;
  var image = images(300, 300);
  var idx = 0;
  json.news.forEach(function (item, i) {
    if (i >= length) return;
    request.get(item.image, { encoding: null }, function (err, res, data) {
      if (err || res.statusCode != 200 || data.length < 100) {
        ++idx;
      } else {
        image.draw(images(data).size(width, width), i % size * width, Math.floor(i / size) * width);
        if (++idx == length) {
          uploader.uploadData(image.encode('jpg'), 'mosaic/' + json.date + '.jpg');
        }
      }
    });
  });
}

function getKey(url) {
  url = url + '';
  return url.substring(url.lastIndexOf('/') + 1);
}

var template = '\
  <div class="grid">\
    <div>\
      <img src="<%= config.cdn + story.image %>" alt="<%= story.title %>"/>\
      <aside class="top"><span class="source">图片：<%= story.image_source %></span></aside>\
      <a href="<%= story.share_url %>" target="_blank" title="点击查看原文">\
        <aside class="bottom">\
          <span class="caption"><%= story.title %></span>\
        </aside>\
      </a>\
    </div>\
  </div>';
function fetchStory(id, date) {
  var url = "http://news.at.zhihu.com/api/2/news/" + id;
  request.get(url, function (err, res, data) {
    if (err || res.statusCode != 200) return;
    log("====== fetchStory: " + id + " ======");
    var item = JSON.parse(data);
    item.date = date;
    delete item.ga_prefix;
    delete item.css;
    delete item.js;
    item.image = '/image/' + getKey(item.image);
    item.thumbnail = '/thumbnail/' + getKey(item.thumbnail);
    var images = item.body.match(/http:\/\/[\w]+\.zhimg.com\/[\w_.\/]+/g);
    var isLatest = date == latestDate;
    for (var i in images) {
      var image = images[i];
      if (image.indexOf('_is.jpg') > 0) {
        item.body = item.body.replace(image, config.cdn + '/avatar/' + getKey(image));
        if (isLatest)
          uploader.uploadLink(image, 'avatar/' + getKey(image));
      } else {
        item.body = item.body.replace(image, config.cdn + '/content/' + getKey(image));
        if (isLatest)
          uploader.uploadLink(image, 'content/' + getKey(image));
      }
    }
    var html = ejs.render(template, {config: config, story: item});
    item.body = item.body.replace('<div class="img-place-holder"></div>', html);
    item._id = 'news-' + item.id;
    db.put(item).catch(function (err) {
    });
  });
}
function fetchBefore(beforeDate) {
  var url = "http://news.at.zhihu.com/api/2/news/before/" + beforeDate;
  request.get(url, function (err, res, data) {
    if (err || res.statusCode != 200) return;
    log("====== fetchBefore: " + beforeDate + " ======");
    var json = JSON.parse(data);
    mosaic(json);
    json.news.forEach(function (item) {
      fetchStory(item.id, json.date);
      item.date = json.date;
      delete item.ga_prefix;
      item.url = '/story/' + item.id;
      item.image = '/image/' + getKey(item.image);
      item.thumbnail = '/thumbnail/' + getKey(item.thumbnail);
    });
    json._id = 'daily-' + json.date;
    db.put(json).catch(function (err) {
    });
    if (!initiated)
      if (json.date != endDate)
        fetchBefore(json.date);
      else
        initiated = true;
    if (initiated) {
      log("====== initiated ======");
      fetchHot();
      fetchSections();
    }
  });
}
function fetchLatest() {
  var url = "http://news.at.zhihu.com/api/2/news/latest";
  request.get(url, function (err, res, data) {
    if (err || res.statusCode != 200) return;
    log("====== fetchLatest ======");
    var json = JSON.parse(data);
    if (latest.news && (json.news.length + 1) == latest.news.length)  return;
    uploader.updateUptoken();
    json.news.forEach(function (item) {
      fetchStory(item.id, json.date, true);
      uploader.uploadLink(item.image, 'image/' + getKey(item.image));
      uploader.uploadLink(item.thumbnail, 'thumbnail/' + getKey(item.thumbnail));
      item.date = json.date;
      delete item.ga_prefix;
      item.url = '/story/' + item.id;
      item.image = '/image/' + getKey(item.image);
      item.thumbnail = '/thumbnail/' + getKey(item.thumbnail);
    });
    var before = moment(json.date, 'YYYYMMDD').subtract(1, 'days').format('YYYYMMDD');
    db.get('daily-' + before).then(function (data) {
      json.news.push({
        title: '前一天（' + data.news.length + ' 条内容）',
        url: '/date/' + before,
        image: '/mosaic/' + data.date + '.jpg',
        thumbnail: '/mosaic/' + data.date + '.jpg'
      });
      latest = json;
    }).catch(function (err) {
    });
    latest = json;
    if (latestDate != json.date) {
      latestDate = json.date;
      fetchBefore(json.date);
    }
  });
};
function fetchHot() {
  var url = "http://news.at.zhihu.com/api/2/news/hot";
  request.get(url, function (err, res, data) {
    if (err || res.statusCode != 200) return;
    log("====== fetchHot ======");
    var json = JSON.parse(data);
    json.recent.forEach(function (item) {
      item.url = '/story/' + item.news_id;
      item.thumbnail = '/thumbnail/' + getKey(item.thumbnail);
      db.get('news-' + item.news_id).then(function (data) {
        item.date = data.date;
        item.image = '/image/' + getKey(data.image);
        hot = json;
      }).catch(function (err) {
      });
    });
  });
};

function fetchSections() {
  var url = "http://news.at.zhihu.com/api/2/sections";
  request.get(url, function (err, res, data) {
    if (err || res.statusCode != 200) return;
    log("====== fetchSections ======");
    var json = JSON.parse(data);
    var thumbnails = [];
    json.data.forEach(function (item) {
      item.url = '/section/' + item.id;
      item.thumbnail = '/thumbnail/' + getKey(item.thumbnail);
      thumbnails.push(item.thumbnail);
    });
    db.query(function (doc) {
      if (doc.thumbnail) {
        emit(doc.thumbnail, doc.image);
      }
    }, {reduce: false, keys: thumbnails}).then(function (data) {
      data.rows.forEach(function (item, i) {
        json.data[i].image = item.value;
      });
      sections = json;
    })
  });
};

global.getKey = getKey;

exports.latest = function () {
  return latest;
}
exports.hot = function () {
  return hot;
}
exports.sections = function () {
  return sections;
}
exports.run = function () {
  fetchLatest();
  setInterval(fetchLatest, 10 * 60 * 1000);
}