var request = require('request');
var log = require('util').log;
var fs = require('fs');

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