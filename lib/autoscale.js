var Rx = require('rx');
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
  var published = this._mainStream().publish();
  this._checkByHostNumStream(published);
  this._checkBySpecifiedTimeStream(published);
  this._checkByConnNumAverageStream(published);
  published.connect();
};

// private

Autoscale.prototype._mainStream = () => {
  if (this.serverType === 'lobby') var key = config.get('redisKeyForLobbyLoadbalancing');
  else var key = config.get('redisKeyForGameLoadbalancing');

  return Rx.Observable.fromPromise(this.redis.zrange([key, 0, -1, 'withscores']))
    .flatMap((ipAndConnNumStr) => {
      return __.filter(ipAndConnNumStr, (_, i) => { return i%2 !== 0 })
    })
    .map((connNumStr) => {
      return parseInt(connNumStr);
    })
    .filter((connNum) => {
      return connNum !== config.get('connNumForRedHost');
    })
    .toArray();
}

// scale out when instances are below minimum host number.
Autoscale.prototype._checkByHostNumStream = (parentStream) => {
  var _this = this;
  parentStream.subscribe((connNumsOfGreenHost) => {
    return Rx.Observable.fromArray(connNumsOfGreenHost)
      .count()
      .filter((countOfGreenHosts) => {
        return countOfGreenHosts <= config.get('minimumGreenHostsNum');
      })
      .subscribe(() => {
        _this._scaleOut();
      });
  });
}

// scale out when specified period of time.
Autoscale.prototype._checkBySpecifiedTimeStream = (parentStream) => {
  var _this = this;
  parentStream.subscribe((connNumsOfGreenHost) => {
    return Rx.Observable.fromArray(connNumsOfGreenHost)
      .count()
      .filter((countOfGreenHosts) => {
        return countOfGreenHosts * config.get('serverTypeNum') < config.get('specifiedTimeGreenHostsNum');
      })
      .filter(() => {
        return _this._isBetween(config.get('forceScaleOutStartAt'), config.get('forceScaleOutEndAt'));
      })
      .subscribe(() => {
        _this._applyCloudformation(config.get('specifiedTimeGreenHostsNum'));
      });
  });
}

// judge scale in/out from connection average.
Autoscale.prototype._checkByConnNumAverageStream = (parentStream) => {
  var _this = this;
  parentStream.subscribe((connNumsOfGreenHost) => {
    var checkByConnNumAverageStream = Rx.Observable.fromArray(connNumsOfGreenHost)
      .average()
      .map(ave => { return parseInt(ave); })
      .publish();
    _this._notifySlackStream1(checkByConnNumAverageStream);
    _this._notifySlackStream2(checkByConnNumAverageStream);
    _this._scaleOutStream(checkByConnNumAverageStream);
    _this._scaleInStream(checkByConnNumAverageStream);
    checkByConnNumAverageStream.connect();
  });
}

Autoscale.prototype._notifySlackStream1 = (parentStream) => {
  parentStream.subscribe((connNumAverage) => {
    return Rx.Observable.just(connNumAverage)
      .filter((connNumAverage) => {
        return connNumAverage > CONN_NUM_BY_LB;
      })
      .filter(() => {
        return Math.floor( Math.random() * 10 ) === 0;
      })
      .subscribe(() => {
        slack.notify(config.get('notifyRoomNumMessage') + (connNumAverage - CONN_NUM_BY_LB))
      });
  });
}

Autoscale.prototype._notifySlackStream2 = (parentStream) => {
  var _this = this;
  parentStream.subscribe((connNumAverage) => {
    return Rx.Observable.just(connNumAverage)
      .filter(() => {
        return Math.floor( Math.random() * 300 ) === 0;
      })
      .subscribe(() => {
        slack.notify('_this.greenHostsNum: ' + _this.greenHostsNum);
        slack.notify('connNumAverageOfGreenHosts: ' + connNumAverage);
      });
  });
}

Autoscale.prototype._scaleOutStream = (parentStream) => {
  var _this = this;
  parentStream.subscribe((connNumAverage) => {
    return Rx.Observable.just(connNumAverage)
      .filter((connNumAverage) => {
        return connNumAverage >= config.get('scaleOutThreshold');
      })
      .subscribe(() => {
        _this._scaleOut();
      });
  });
}

Autoscale.prototype._scaleInStream = (parentStream) => {
  var _this = this;
  parentStream.subscribe((connNumAverage) => {
    return Rx.Observable.just(connNumAverage)
      .filter((connNumAverage) => {
        return connNumAverage <= config.get('scaleInThreshold');
      })
      .filter(() => {
        return _this._isBetween(config.get('scaleInAvailableStartAt'), config.get('scaleInAvailableEndAt'));
      })
      .subscribe(() => {
        _this._scaleIn();
      });
  });
}

Autoscale.prototype._isBetween = (startAt, endAt) => {
  var startAt = this._now().clone().startOf('day').add(startAt, 'hours');
  var endAt = this._now().clone().startOf('day').add(endAt, 'hours');
  var isBetween = (this._now() >= startAt && this._now() < endAt);
  log.autoscale.info('_isBetween:', isBetween);
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
      'export INSTANCE_NUM=' + newHostNum + ' && ' + config.get('cfnUpdateCmd') + config.get('cfnStackName'));
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
    h <=  10 ?  40 :
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
