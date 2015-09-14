var co = require('co');
var log = require('./log');
var config = require('config');
var child_process = require('./child_process');

const MONITOR_CPU_USAGE_CMD = 'sh scripts/monitor_cpu_usage.sh'
const RESTART_CMD = 'sudo su - deployer -c "forever restartall"'

function monitor(cpuThreshold) {
  setInterval(() => {
    co(function *() {
      var cpu_usage = yield child_process.exec(MONITOR_CPU_USAGE_CMD);
      log.autoscale.info('cpu usage / cpuThreshold', cpu_usage, cpuThreshold);
      if (cpu_usage <= cpuThreshold) return;
      var result = yield child_process.exec(RESTART_CMD);
      log.autoscale.info(result);
    }).catch((err) => {
      log.error.info(err);
    })
  }, config.get('autoRestartMonitorIntervalSec') * 1000);
}
exports.monitor = monitor;
