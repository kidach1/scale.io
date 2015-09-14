var child_process = require('./child_process');
var config = require('config');
var co = require('co');
var log = require('./log');
var AWS = require('./aws');
var Redis = require("./redis");
var Autoscale = require("./autoscale");
var restartGroupTag = process.env.NODE_RESTART_GROUP_TAG || "groupA";

const GET_MY_INSTANCE_ID_CMD = "curl http://169.254.169.254/latest/meta-data/instance-id";
const RESTART_CMD = 'sudo su - deployer -c "forever restartall"';

module.exports = exports = RollingRestart;

function RollingRestart(serverType) {
  this.serverType = serverType;
  this.redis = new Redis();
  this.ec2 = new AWS.EC2();
  this.autoscale = new Autoscale();
}

RollingRestart.prototype.execute = () => {
  var _this = this;
  co(function *() {
    if (process.env.NODE_ENV === 'test') throw new Error('you should be EC2 instance');
    var describeTagsStr = yield _this.redis.get(["describeTags"]);
    if (describeTagsStr) var describeTags = JSON.parse(describeTagsStr);
    else var describeTags = yield _this._describeTags();
    var instanceId = yield child_process.exec(GET_MY_INSTANCE_ID_CMD);
    var isRestartGroup = _this._isRestartGroup(describeTags, instanceId, restartGroupTag);
    if (isRestartGroup) {
      var serverTypeTag = _this._getServerTypeTag(describeTags, instanceId);
      yield _this._removeFromLB(instanceId, serverTypeTag);
      yield _this.autoscale._resetLbKeys();
      yield _this._sleep((config.get('intervalForHostInfoUpdateSec') + 2) * 1000);
      yield _this._restart();
      yield _this._attachToLB(instanceId, serverTypeTag);
    }
    _this.redis.client.end();
  }).catch((err) => {
    log.autoscale.error(err);
  });
};

// private

RollingRestart.prototype._describeTags = () => {
  var _this = this;
  return new Promise ((resolve, reject) => {
    _this.ec2.describeTags({}, (err, data) => {
      if (err) {
        reject(err);
      } else {
        _this.redis.set(["describeTags", JSON.stringify(data)]);
        _this.redis.expire(["describeTags", 180]);
        resolve(data);
      }
    });
  });
};

RollingRestart.prototype._creatTags = (instanceId, tagValue) => {
  var _this = this;
  var params = {
    Resources: [instanceId],
    Tags: [{Key: 'Name', Value: tagValue}]
  };
  return new Promise ((resolve, reject) => {
    _this.ec2.createTags(params, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
};

RollingRestart.prototype._isRestartGroup = (describeTags, instanceId, restartGroupTag) => {
  var result = false;
  describeTags.Tags.forEach((tag) => {
    if (tag === undefined) return;
    if (tag.ResourceId.match(instanceId) &&
      tag.Key.match(/restartGroup/) && tag.Value.match(restartGroupTag)) result = true;
  });
  return result;
};

RollingRestart.prototype._getServerTypeTag = (describeTags, instanceId) => {
  var result = false;
  describeTags.Tags.forEach((tag) => {
    if (tag === undefined) return;
    if (tag.ResourceId.match(instanceId) && tag.Key.match(/Name/)) result = tag.Value;
  });
  return result;
};

RollingRestart.prototype._removeFromLB = (instanceId, serverTypeTag) => {
  return this._creatTags(instanceId, serverTypeTag + "-having-a-break");
};

RollingRestart.prototype._attachToLB = (instanceId, serverTypeTag) => {
  return this._creatTags(instanceId, serverTypeTag);
};

RollingRestart.prototype._restart = () => {
  return child_process.exec(RESTART_CMD);
};

RollingRestart.prototype._sleep = (ms) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      return resolve(true);
    }, ms);
  });
};

// entry point
var serverType = process.env.NODE_SERVER_TYPE === null ? 'lobby' : process.env.NODE_SERVER_TYPE;
var rr = new RollingRestart(serverType);
rr.execute();
