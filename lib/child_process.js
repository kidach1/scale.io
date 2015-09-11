var co = require('co');
var log = require('./log');
var config = require('config');
var child_process = require('child_process');

function exec(cmd) {
  return new Promise((resolve, reject) => {
    child_process.exec(cmd, (err, stdout) => {
      if (!err && stdout.match(/\[ERROR\]/) === null) {
        resolve(stdout);
      } else {
        reject(err);
      }
    });
  });
}
exports.exec = exec;
