var __ = require('underscore');
var co = require('co');
var log = require('../lib/log');
var AWS = require('../lib/aws');
var util = require('util');
var slack = require("../lib/slack");
var Redis = require("../lib/redis");
var config = require('config');
var ServerStatus = require('../lib/server_status.js');
var Autoscale = require('../schedulers/autoscale.js');

require('./scheduler_monitored');
var SchedulerMonitor = require('./scheduler_monitor');
sm = new SchedulerMonitor();
sm.exec();

var autoRestart = require('../lib/auto_restart');
autoRestart.monitor(
  config.get('autoRestartCpuUsageThresholdForLB'));

module.exports = exports = LoadBalance;

function LoadBalance(serverType, port) {
  this.redis = new Redis();
  this.ec2 = new AWS.EC2();
  this.ServerStatus = new ServerStatus(
    serverType, port, this.redis, this.ec2);
}

LoadBalance.prototype.updateHostList = () => {
  return this.ServerStatus.updateHostList().catch((err) => {
    console.log(err);
    log.loadbalance.error(err.stack);
  });
};

// entry point
var serverType = process.env.NODE_SERVER_TYPE === null ? 'lobby' : process.env.NODE_SERVER_TYPE;
var port = serverType === 'lobby' ? 9000 : 9100;
var lb = new LoadBalance(serverType, port);

// LB launch
setInterval(() => {
  co(function *() {
    yield lb.updateHostList();
    log.loadbalance.info('hostsInfo updated!');
  }).catch((err) => {
    slack.notify('@' + lb.ServerStatus.ServerType + ' loadbalancer err! ' + err);
  });
}, config.get('intervalForLoadBalancingSec') * 1000)

// Autoscale launch
if (serverType === 'game') {
  log.autoscale.info('autoscale watcher loaded. serverType is', serverType);
  var autoscale = new Autoscale(serverType);
  autoscale.initTasks();

  setInterval(() => {
    autoscale.checkAndApply();
  }, config.get('intervalForAutoscalingSec') * 1000);
}
