var config = require('../../config');
var localUploader = require('./local');
var qiniuUploader = require('./qiniu');

var uploader = config.qiniu.ACCESS_KEY ? qiniuUploader : localUploader;

module.exports = uploader;