var co = require('co');
var __ = require('underscore');
var log = require('./log');
var AWS = require('./aws');
var util = require('util');
var Redis = require("./redis");
var slack = require("./slack");
var config = require('config');
var Autoscale = require('.//autoscale.js');
var ServerStatus = require('./server_status.js');

require('./scheduler_monitored');
var SchedulerMonitor = require('./scheduler_monitor');
sm = new SchedulerMonitor();
sm.exec();

var autoRestart = require('./auto_restart');
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
