var config = require('config');
var AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: config.get('aws.accessKeyId'),
  secretAccessKey: config.get('aws.secretAccessKey'),
  region: config.get('aws.region')
});

module.exports = exports = AWS;
