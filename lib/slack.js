var config = require("config");
var nodeSlack = require('node-slack');
var slack = new nodeSlack(config.get('slack.hook_url'));

function notify(msg) {
  if (process.env.NODE_ENV === 'development')
    return;
  slack.send({
    text: config.get('slack.mention') + ' ' + process.env.NODE_ENV + ': ' + msg,
    channel: config.get('slack.channel'),
    username: config.get('slack.botname')
  });
}
exports.notify = notify;
