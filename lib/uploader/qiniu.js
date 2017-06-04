var request = require('request');
var qiniu = require('qiniu');
var config = require('../../config');

qiniu.conf.ACCESS_KEY = config.qiniu.ACCESS_KEY;
qiniu.conf.SECRET_KEY = config.qiniu.SECRET_KEY;
var bucketname = config.qiniu.buckname;
var domain = config.qiniu.domain;
var log = require('util').log;

var uptoken = getUptoken(bucketname);

function getUptoken(bucketname) {
  var putPolicy = new qiniu.rs.PutPolicy(bucketname);
  return putPolicy.token();
}

function onret(err, ret, res) {
  if (!err) {
    log("====== uploaded: " + ret.key + " ======");
  } else {
    console.log(err);
  }
}

function uploadData(body, key, callback) {
  var callback = callback || onret;
  log("====== uploadData: " + key + " ======");
  qiniu.io.put(uptoken, key, body, null, callback);
}

function uploadFile(localFile, key, callback) {
  var callback = callback || onret;
  log("====== uploadFile: " + key + " ======");
  qiniu.io.putFile(uptoken, key, localFile, null, callback);
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

var client = new qiniu.rs.Client();

function deleteFile(key) {
  log("====== deleteFile: " + key + " ======");
  client.remove(bucketname, key, function (err, res) {
  });
}

exports.updateUptoken = function () {
  uptoken = getUptoken(bucketname);
}
exports.uploadData = uploadData;
exports.uploadFile = uploadFile;
exports.uploadLink = uploadLink;
exports.deleteFile = deleteFile;