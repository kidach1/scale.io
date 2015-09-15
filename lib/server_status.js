var co = require('co');
var __ = require('underscore');
var io = require('socket.io-client');
var log = require('./log');
var util = require('util');
var config = require('config');

module.exports = exports = ServerStatus;

function ServerStatus(serverType, port, redis, ec2) {
  this.ec2 = ec2;
  this.params = {};
  this.redis = redis;
  if (process.env.NODE_ENV === 'test') var domain = '';
  else var domain = '.ap-northeast-1.compute.amazonaws.com';
  this.domain = domain;
  this.serverType = serverType;
  this.port = port;
  this._setEC2HostsWithInterval();
}

/**
 * Produces an `error` packet.
 *
 * @param {Object} like [[:conn, :host], [:conn, :host], ..]
 * @api private
 */
ServerStatus.prototype.updateHostList = () => {
  var _this = this;
  return _this.hostsWithConnCnt().then((hostsInfo) => {
    log.loadbalance.info(_this.port, hostsInfo);
    return Promise.all(
      hostsInfo.map((hostInfo) => {
        var connNum = hostInfo[0];
        var hostName = hostInfo[1];
        if (_this.serverType === 'lobby') var key = config.get('redisKeyForLobbyLoadbalancing');
        else var key = config.get('redisKeyForGameLoadbalancing');
        return _this.redis.zadd([key, connNum, hostName]);
      })
    );
  });
};

// private

ServerStatus.prototype.hostsWithConnCnt = () => {
  var _this = this;
  return Promise.all(
    __.map(_this.ec2Hosts, (host) => {
      var socket = io.connect('http://' + host + _this.domain + ':' + _this.port);
      socket.emit('INFO');
      return _this._on(socket);
    })
  ).then((values) => {
      if (values.length === 0) return Promise.reject('no host!')
      connCntAndHosts = __.zip.apply(null, [ values, _this.ec2Hosts ]);
      return Promise.resolve(connCntAndHosts);
    });
};

ServerStatus.prototype._setEC2HostsWithInterval = () => {
  var _this = this;
  _this._setEC2Hosts();
  setInterval(() => {
    _this._setEC2Hosts();
  }, config.get('intervalForHostInfoUpdateSec') * 1000)
};

ServerStatus.prototype._setEC2Hosts = () => {
  var _this = this;
  co(function *() {
    _this.ec2Hosts = yield(_this._getHostList());
  }).catch((err) => {
    console.log('err occured! ec2Hosts is not updated.', err)
  });
};

ServerStatus.prototype._getHostList = () => {
  if (process.env.NODE_ENV === 'test') return Promise.resolve(['localhost']);
  var _this = this;
  return _this._ec2Instances().then((result) => {
    return _this._pickupHostName(result);
  });
};

ServerStatus.prototype._on = (socket) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve(config.get('connNumForRedHost'));
    }, config.get('timeoutThresholdForRedHost'));
    socket.removeListener('INFO');
    socket.on('INFO', (connNum) => {
      resolve(connNum);
    });
  });
};

ServerStatus.prototype._ec2Instances = () => {
  var _this = this;
  return new Promise ((resolve, reject) => {
    _this.ec2.describeInstances(_this.params, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
};

ServerStatus.prototype._pickupHostName = (data) => {
  var hostLists = [];
  var ec2HostTag = this.serverType === "lobby" ? config.get('ec2HostTagForLobby') : config.get('ec2HostTagForGame');
  data.Reservations.forEach((reservation) => {
    instance = reservation.Instances[0];
    instance.Tags.forEach((tag) => {
      if (tag === undefined) return;
      if (tag.Key.match(/Name/) && tag.Value.match(ec2HostTag)) {
        hostLists.push(instance.PublicDnsName.split('.')[0]);
      }
    })
  });
  return Promise.resolve(
    __.reject(__.uniq(hostLists), (host) => { return host === '' })
  );
};
