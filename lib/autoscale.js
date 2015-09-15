var co = require('co');
var __ = require('underscore');
var log = require('./log');
var Redis = require("./redis");
var slack = require("./slack");
var config = require('config');
var moment = require('moment-timezone');
var child_process = require('./child_process');
const CONN_NUM_BY_LB = 1;

module.exports = exports = Autoscale;

function Autoscale(serverType) {
  this.serverType = serverType;
  this.greenHostsNum = 0;
  this.applicableForScaleOut = false;
  this.applicableForScaleIn = false;
}

Autoscale.prototype.initTasks = () => {
  this.redis = new Redis();
  this._updateApplicable();
  this._resetLbKeysRoutine();
};

Autoscale.prototype.checkAndApply = () => {
  var _this = this;
  co(function *() {
    if (_this.serverType === 'lobby') var key = config.get('redisKeyForLobbyLoadbalancing');
    else var key = config.get('redisKeyForGameLoadbalancing');
    var ipAndConnNumsStr = yield _this.redis.zrange([key, 0, -1, 'withscores']);
    var connNumsStr = _this._getOddAttributes(ipAndConnNumsStr);
    var connNums = _this._parseInt4Arr(connNumsStr);
    if (connNums.length === 0) return; // no connNums means resetLbKes just run.
    var connNumsOfGreenHosts = _this._greenHostsFrom(connNums);
    _this.greenHostsNum = connNumsOfGreenHosts.length * config.get('serverTypeNum');
    log.autoscale.info('_this.greenHostsNum', _this.greenHostsNum);
    if (_this._checkByMinimumHostNum(connNumsOfGreenHosts)) return;
    if (_this._checkBySpecifiedTime(connNumsOfGreenHosts)) return;
    _this._checkByConnNumAverage(connNumsOfGreenHosts);
  });
};

// private

Autoscale.prototype._getOddAttributes = (arr) => {
  return __.filter(arr, (_, i) => { return i%2 !== 0 });
};

Autoscale.prototype._parseInt4Arr = (arr) => {
  return __.map(arr, (attr) => { return parseInt(attr) });
};

Autoscale.prototype._greenHostsFrom = (connNums) => {
  return __.reject(connNums, (connNum) => {
    return connNum === config.get('connNumForRedHost');
  });
};

// scale out when instances are below minimum host number.
Autoscale.prototype._checkByMinimumHostNum = (connNumsOfGreenHosts) => {
  if (connNumsOfGreenHosts.length > config.get('minimumGreenHostsNum')) return false;
  this._scaleOut();
  return true;
};

// scale out when specified period of time.
Autoscale.prototype._checkBySpecifiedTime = (connNumsOfGreenHosts) => {
  if (connNumsOfGreenHosts.length >= config.get('specifiedTimeGreenHostsNum')) return false;
  if (!this._isBetween(config.get('forceScaleOutStartAt'), config.get('forceScaleOutEndAt'))) return false;
  this._applyCloudformation(config.get('specifiedTimeGreenHostsNum'));
  return true;
};

// judge scale in/out from connection average.
Autoscale.prototype._checkByConnNumAverage = (connNumsOfGreenHosts) => {
  var connNumSum = this._sumFrom(connNumsOfGreenHosts);
  var connNumAverage = parseInt(connNumSum / connNumsOfGreenHosts.length);
  if (connNumAverage >= (CONN_NUM_BY_LB + 1)) this._notifyRoomNum(connNumsOfGreenHosts);
  if (Math.floor( Math.random() * 300 ) === 0) {
    slack.notify('this.greenHostsNum: ' + this.greenHostsNum);
    slack.notify('connNumAverageOfGreenHosts: ' + connNumAverage);
  }
  log.autoscale.info(connNumAverage);
  if (connNumAverage >= config.get('scaleOutThreshold')) this._scaleOut();
  if (this._isBetween(config.get('scaleInAvailableStartAt'), config.get('scaleInAvailableEndAt'))
    && connNumAverage <= config.get('scaleInThreshold')) this._scaleIn();
};

Autoscale.prototype._sumFrom = (connNums) => {
  return __.reduce(connNums, (sum, i) => { return sum += i} );
};

Autoscale.prototype._notifyRoomNum = (connNumsOfGreenHosts) => {
  if (Math.floor( Math.random() * 7 ) !== 0) return;
  var connNumsOfhavingConnsHosts = this._connNumsOfHavingConnsHostsFrom(connNumsOfGreenHosts);
  var roomNum = this._roomFrom(connNumsOfhavingConnsHosts);
  slack.notify(config.get('notifyRoomNumMessage') + roomNum);
};

Autoscale.prototype._connNumsOfHavingConnsHostsFrom = (connNums) => {
  return __.reject(connNums, (connNum) => {
    return connNum === 1;
  });
};

Autoscale.prototype._roomFrom = (connNumsOfhavingConnsHosts) => {
  return parseInt((this._sumFrom(connNumsOfhavingConnsHosts) - CONN_NUM_BY_LB * connNumsOfhavingConnsHosts.length) / 4);
};

Autoscale.prototype._isBetween = (startAt, endAt) => {
  var startAt = this._now().clone().startOf('day').add(startAt, 'hours');
  var endAt = this._now().clone().startOf('day').add(endAt, 'hours');
  var isBetween = (this._now() >= startAt && this._now() < endAt);
  log.autoscale.info('_isBetween, startAt, endAt)', isBetween, startAt, endAt);
  return isBetween;
};

Autoscale.prototype._now = () => {
  return moment().tz('Asia/Tokyo');
};

Autoscale.prototype._applyCloudformation = (newHostNum) => {
  var _this = this;
  if (!_this._isApplicable(newHostNum)) return;
  co(function *() {
    _this._resetApplicable();
    var oldHostNum = _this.greenHostsNum;
    var result = yield child_process.exec(
      'export INSTANCE_NUM=' + newHostNum + ' && ' + config.get('kumogataUpdateCmd') + config.get('cfnStackName'));
    slack.notify('autoscale success! HostNum change to ' + newHostNum + ' from ' + oldHostNum);
    log.autoscale.info(result);
    yield _this._resetLbKeys();
    log.autoscale.info('resetkeys & restart self!');
    setTimeout(() => {
      child_process.exec(config.get('restartCmd'));
    }, 2*1000);
  }).catch((err) => {
    slack.notify('autoscale failed! ' + err);
    log.error.info(err);
  });
};

Autoscale.prototype._updateApplicable = () => {
  var _this = this;
  setInterval(() => { _this.applicableForScaleOut = true },
    config.get('scaleOutMinimumIntervalSec') * 1000);
  setInterval(() => {_this.applicableForScaleIn = true },
    config.get('scaleInMinimumIntervalSec') * 1000);
};

Autoscale.prototype._resetApplicable = () => {
  this.applicableForScaleOut = false;
  this.applicableForScaleIn = false;
};

Autoscale.prototype._isApplicable = (newHostNum) => {
  log.autoscale.info(
    "\nnewHostNum > this.greenHostsNum", newHostNum > this.greenHostsNum, newHostNum, this.greenHostsNum,
    "\nthis.applicableForScaleOut", this.applicableForScaleOut,
    "\nthis.applicableForScaleIn", this.applicableForScaleIn);
  return newHostNum > this.greenHostsNum ? this.applicableForScaleOut : this.applicableForScaleIn;
};

Autoscale.prototype._resetLbKeys = () => {
  var _this = this;
  return Promise.all([
    _this.redis.del([config.get('redisKeyForLobbyLoadbalancing')]),
    _this.redis.del([config.get('redisKeyForGameLoadbalancing')])
  ]);
};

// refresh loadbalanced info by hosts routinely.
Autoscale.prototype._resetLbKeysRoutine = () => {
  var _this = this;
  setInterval(() => {
    co(function *() {
      yield _this._resetLbKeys();
      log.autoscale.info('resetLbKeys.');
    }).catch((err) => {
      log.autoscale.info('resetLbKeys err', err);
    });
  }, config.get('resetLbKeysRoutineIntervalSec') * 1000);
};

Autoscale.prototype._scaleOut = () => {
  var newHostNum = this._newHostNumForScaleOut(this.greenHostsNum);
  if (newHostNum) this._applyCloudformation(newHostNum);
  else slack.notify('already max autoscaled!');
};

Autoscale.prototype._newHostNumForScaleOut = (h) => {
  var newHostNum =
    h <=  40 ? 100 :
    h <= 100 ? 200 :
    h <= 200 ? 300 :
    h <= 300 ? 400 :
    h <= 400 ? 500 : false;
  return newHostNum;
};

Autoscale.prototype._scaleIn = () => {
  var newHostNum = this._newHostNumForScaleIn(this.greenHostsNum);
  if (newHostNum) this._applyCloudformation(newHostNum);
};

Autoscale.prototype._newHostNumForScaleIn = (h) => {
  var newHostNum =
    h > 450 ? 450 :
    h > 400 ? 400 :
    h > 350 ? 350 :
    h > 300 ? 300 :
    h > 250 ? 250 :
    h > 200 ? 200 :
    h > 150 ? 150 :
    h > 100 ? 100 :
    h >  80 ?  80 :
    h >  60 ?  60 :
    h >  40 ?  40 :
    h >   6 ?   6 : false;
  return newHostNum;
};
