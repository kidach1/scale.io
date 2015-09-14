var log4js = require("log4js");
var env = process.env.NODE_ENV || 'default';
log4js.configure('config/log4js/' + env + '.json');

exports.autoscale = log4js.getLogger('autoscale');
exports.loadbalance = log4js.getLogger('loadbalance');
exports.schedulerMonitor = log4js.getLogger('schedulerMonitor');
if (env === 'production') {
  exports.autoscale.setLevel('INFO');
  exports.loadbalance.setLevel('INFO');
  exports.schedulerMonitor.setLevel('INFO');
}
