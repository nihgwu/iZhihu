var router = require('express').Router();
var fs = require('fs');
var request = require('request');
var moment = require('moment');
var crawler = require('./crawler');

router.get('/undefined', function (req, res, next) {
  res.sendfile('public/img/noimage.jpg');
});

router.get('/', function (req, res, next) {
  res.render('index', {news: crawler.latest().news});
});

router.get('/hot', function (req, res, next) {
  res.render('hot', {title: '热门', news: crawler.hot().recent});
});

router.get('/section', function (req, res, next) {
  res.render('sections', {title: '专题', sections: crawler.sections().data});
});

router.get('/section/:id', function (req, res, next) {
  var url = "http://news.at.zhihu.com/api/2/section/" + req.params.id;
  request.get(url, function (err, resp, data) {
    if (err || resp.statusCode != 200) return next(err);

    var json = JSON.parse(data);
    var ids = [];
    json.news.forEach(function (item) {
      item.url = '/story/' + item.news_id;
      item.date = item.display_date;
      item.thumbnail = '/thumbnail/' + getKey(item.thumbnail);
      ids.push('news-' + item.news_id);
    });
    db.allDocs({keys: ids, include_docs: true}).then(function (data) {
      data.rows.forEach(function (item, i) {
        json.news[i].image = item.doc.image;
      });
      var title = "专题";
      crawler.sections().data.forEach(function (item) {
        if (item.id == req.params.id) {
          title = item.name;
          return;
        }
      });
      res.render('section', {title: title, news: json.news, timestamp: json.timestamp});
    }).catch(function (err) {
      res.status(404).render('error');
    });
  });
});
router.get('/section/:id/before/:timestamp', function (req, res, next) {
  var url = "http://news.at.zhihu.com/api/2/section/" + req.params.id + "/before/" + req.params.timestamp;
  request.get(url, function (err, resp, data) {
    if (err || resp.statusCode != 200) return next(err);

    var json = JSON.parse(data);
    var ids = [];
    json.news.forEach(function (item) {
      item.url = '/story/' + item.news_id;
      item.date = item.display_date;
      item.thumbnail = '/thumbnail/' + getKey(item.thumbnail);
      ids.push('news-' + item.news_id);
    });
    db.allDocs({keys: ids, include_docs: true}).then(function (data) {
      data.rows.forEach(function (item, i) {
        json.news[i].image = item.doc.image;
      });
      res.json(json);
    }).catch(function (err) {
      res.status(404).render('error');
    });
  });
});

router.get('/date', function (req, res, next) {
  var startDate = moment().subtract('days', 1).format('YYYYMMDD');
  var endDate = moment().subtract('days', 30).format('YYYYMMDD');
  var news = [];
  db.allDocs({startkey: 'daily-' + startDate, endkey: 'daily-' + endDate, include_docs: true, descending: true}).then(function (data) {
    data.rows.forEach(function (item) {
      var json = item.doc;
      news.push({
        url: '/date/' + json.date,
        date: json.display_date,
        image: '/mosaic/' + json.date + '.jpg',
        count: json.news.length
      });
    });
    res.render('calendar', {title: '日历', news: news, timestamp: endDate});
  }).catch(function (err) {
    res.status(404).render('error');
  });
});
router.get('/date/before/:date', function (req, res, next) {
  var startDate = moment(req.params.date, 'YYYYMMDD').subtract('days', 1).format('YYYYMMDD');
  var endDate = moment(req.params.date, 'YYYYMMDD').subtract('days', 30).format('YYYYMMDD');
  var news = [];
  db.allDocs({startkey: 'daily-' + startDate, endkey: 'daily-' + endDate, include_docs: true, descending: true}).then(function (data) {
    data.rows.forEach(function (item) {
      var json = item.doc;
      news.push({
        url: '/date/' + json.date,
        date: json.display_date,
        image: '/mosaic/' + json.date + '.jpg',
        count: json.news.length
      });
    });
    var timestamp = endDate;
    if (data.rows.length < 30) timestamp = null;
    res.json({news: news, timestamp: data.rows.length == 30 ? endDate : null});
  }).catch(function (err) {
    res.status(404).render('error');
  });
});
router.get('/date/:date', function (req, res, next) {
  db.get('daily-' + req.params.date).then(function (json) {
    var before = moment(json.date, 'YYYYMMDD').subtract('days', 1).format('YYYYMMDD');
    db.get('daily-' + before).then(function (data) {
      json.news.push({
        title: '前一天（' + data.news.length + ' 条内容）',
        url: '/date/' + before,
        image: '/mosaic/' + data.date + '.jpg',
        thumbnail: '/mosaic/' + data.date + '.jpg'
      });
      res.render('date', {title: json.display_date, news: json.news});
    }).catch(function (err) {
      res.render('date', {title: json.display_date, news: json.news});
    });
  }).catch(function (err) {
    res.status(404).render('error');
  });
});

router.get('/story/:id', function (req, res, next) {
  db.get('news-' + req.params.id).then(function (json) {
    if (json.body.indexOf('禁止转载') > -1 || json.body.indexOf('谢绝转载') > -1) {
      res.render('redirect', {title: json.title, story: json});
    }
    if (json.date == latestDate) {
      var data = crawler.latest();
      for (var i = 0; i < data.news.length; i++) {
        if (data.news[i].id == json.id) {
          var pre = data.news[i - 1] || null;
          var next = data.news[i + 1] || null;
          if(i == data.news.length -2)  next.text = '前一天';
          res.render('story', {title: json.title, story: json, pre: pre, next: next });
        }
      }
    } else {
      db.get('daily-' + json.date).then(function (data) {
        for (var i = 0; i < data.news.length; i++) {
          if (data.news[i].id == json.id) {
            var pre = data.news[i - 1] || null;
            var next = data.news[i + 1] || null;
            if (!pre) {
              var after = moment(json.date, 'YYYYMMDD').add('days', 1).format('YYYYMMDD');
              pre = {title: after, url: '/date/' + after, text: '后一天'};
              if (after == latestDate) pre.url = '/';
            }
            if (!next && json.date != '20130518') {
              var before = moment(json.date, 'YYYYMMDD').subtract('days', 1).format('YYYYMMDD');
              next = {title: before, url: '/date/' + before, text: '前一天'};
            }
            res.render('story', {title: json.title, story: json, pre: pre, next: next });
          }
        }
      }).catch(function (err) {
        res.status(404).render('error');
      })
    }
  }).catch(function (err) {
    res.status(404).render('error');
  });
});

module.exports = router;
