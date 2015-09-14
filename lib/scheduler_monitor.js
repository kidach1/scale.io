var __ = require('underscore');
var co = require('co');
var log = require('./log');
var util = require('util');
var config = require('config');
var moment = require('moment');
var clientIo = require('socket.io-client');
var child_process = require('./child_process');
// when own serverType is Lobby, moniteredServerType is Game and port is 9300.
var port = process.env.NODE_SERVER_TYPE === 'lobby' ? 9300 : 9200;

module.exports = exports = SchedulerMonitor;

function SchedulerMonitor() {
  this.lastAliveTime = moment().unix();
  this.failingOver = false; // failing over?
  this._monitor();
}

SchedulerMonitor.prototype.exec = () => {
  var _this = this;
  setInterval(() => {
    log.schedulerMonitor.info('_this._isMonitoredProcessDead()', _this._isMonitoredProcessDead());
    if (_this._isMonitoredProcessDead()) _this._failOver();
    else _this._endUpfailOver();
  }, config.get('decisionIntervalSec') * 1000);
}

//private

SchedulerMonitor.prototype._monitor = () => {
  var _this = this;
  var monitoringSocket = clientIo.connect(
    "http://" + config.get('monitoredHost') + ':' + port, {'forceNew': true});

  setInterval(() => {
    log.schedulerMonitor.info('Do you alive?');
    monitoringSocket.emit('DO_YOU_ALIVE');
  }, config.get('monitoringIntervalSec') * 1000);

  monitoringSocket.on('IM_ALIVE', () => {
    log.schedulerMonitor.info('Im alive!', moment().unix());
    _this.lastAliveTime = moment().unix();
  });
}

SchedulerMonitor.prototype._isMonitoredProcessDead = () => {
  log.schedulerMonitor.info('this.lastAliveTime', this.lastAliveTime);
  log.schedulerMonitor.info('moment().unix()', moment().unix());
  var gracePeriodSec = config.get('monitoringIntervalSec');
  return (this.lastAliveTime + gracePeriodSec) < moment().unix();
}

// fail over for monitored process.
SchedulerMonitor.prototype._failOver = () => {
  var _this = this;
  if (_this.failingOver) return;
  log.schedulerMonitor.info('_failOver! monitored host/process is dead!');
  var cmd = "sudo su - deployer -c 'cd /ebs1/palmx-realtime-server && NODE_ENV=production NODE_SERVER_TYPE="
    + config.get('monitoredProcess')
    + " PATH=$PATH:/usr/local/bin forever start -c \"node --harmony\" schedulers/load_balance.js "
    + config.get('monitoredProcess') + "'";
  log.schedulerMonitor.info('cmd!', cmd);
  child_process.exec(cmd).then((result) => {
    log.schedulerMonitor.info('_failOverResult', result);
    _this.failingOver = true;
  }).catch((err) => {
    log.schedulerMonitor.error('failOver error', err);
  });
}

// kill failing over process if monitored process revived.
SchedulerMonitor.prototype._endUpfailOver = () => {
  var _this = this;
  log.schedulerMonitor.info('monitored host/process is alive!');
  log.schedulerMonitor.info('_endUpfailOver!');
  co(function *() {
    var monitoredProcessId =
      yield child_process.exec("sudo su - deployer -c 'pgrep -f " + config.get('monitoredProcess') + "'");
    log.schedulerMonitor.info('monitoredProcessId', monitoredProcessId);
    if (monitoredProcessId === "") return;
    child_process.exec("sudo su - deployer -c 'forever stop " + monitoredProcessId + "'").then(() => {
      _this.failingOver = false;
    });
  });
}
