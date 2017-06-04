var request = require('request');
var log = require('util').log;
var fs = require('fs');

fs.access('data', fs.constants.F_OK, function (err) {
  if(!err) return;
  fs.mkdirSync('data');
  fs.mkdirSync('data/image');
  fs.mkdirSync('data/thumbnail');
  fs.mkdirSync('data/avatar');
  fs.mkdirSync('data/content');
  fs.mkdirSync('data/mosaic');
})

function onret(err, key) {
  if (!err) {
    log("====== uploaded: " + key + " ======");
  } else {
    console.log(err, key);
  }
}

function uploadData(body, key, callback) {
  var callback = callback || onret;
  log("====== uploadData: " + key + " ======");
  fs.writeFile('data/' + key, body, function(err) {
    callback(err, key);
  });
}

function uploadLink(url, key, callback) {
  request.get(url, { encoding: null, timeout: 10000 }, function (err, res, data) {
    if (err || res.statusCode != 200) {
      return setTimeout(function () {
        uploadLink(url, key, callback)
      }, 10000)
    }
    uploadData(data, key, callback);
  });
}

exports.updateUptoken = function () {}
exports.uploadData = uploadData;
exports.uploadLink = uploadLink;