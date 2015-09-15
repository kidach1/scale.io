var config = require("config");
var redis = require("redis");
var Redis = (function () {
  function Redis() {
    this.redis = redis;
    this.client = redis.createClient(config.get('redisConfig.port'), config.get('redisConfig.host'));
  }
  Redis.prototype.rpush = function (args) {
    var _this = this;
    return new Promise(function (resolve) {
      return _this.client.rpush(args, function (err, data) { return resolve(data); });
    });
  };
  Redis.prototype.lrange = function (args) {
    var _this = this;
    return new Promise(function (resolve) {
      return _this.client.lrange(args, function (err, data) { return resolve(data); });
    });
  };
  Redis.prototype.del = function (args) {
    var _this = this;
    return new Promise(function (resolve) {
      return _this.client.del(args, function (err, data) { return resolve(data); });
    });
  };
  //args: key, score, member
  Redis.prototype.zadd = function (args) {
    var _this = this;
    return new Promise(function (resolve, reject) {
      return _this.client.zadd(args, function (err, data) {
        if (err)
          reject(err);
        else
          resolve(data);
      });
    });
  };
  Redis.prototype.set = function (args) {
    var _this = this;
    return new Promise(function (resolve) {
      return _this.client.set(args, function (err, data) { return resolve(data); });
    });
  };
  Redis.prototype.get = function (args) {
    var _this = this;
    return new Promise(function (resolve) {
      return _this.client.get(args, function (err, data) { return resolve(data); });
    });
  };
  Redis.prototype.expire = function (args) {
    var _this = this;
    return new Promise(function (resolve) {
      return _this.client.expire(args, function (err, data) { return resolve(data); });
    });
  };
  Redis.prototype.hset = function (args) {
    var _this = this;
    return new Promise(function (resolve) {
      return _this.client.hset(args, function (err, data) { return resolve(data); });
    });
  };
  Redis.prototype.hmset = function (args) {
    var _this = this;
    return new Promise(function (resolve, reject) {
      return _this.client.hmset(args, function (err, data) {
        if (err)
          reject(err);
        else
          resolve(data);
      });
    });
  };
  Redis.prototype.hget = function (args) {
    var _this = this;
    return new Promise(function (resolve) {
      return _this.client.hget(args, function (err, data) { return resolve(data); });
    });
  };
  Redis.prototype.hgetall = function (args) {
    var _this = this;
    return new Promise(function (resolve) {
      return _this.client.hgetall(args, function (err, data) { return resolve(data); });
    });
  };
  Redis.prototype.zrangebyscore = function (args) {
    var _this = this;
    return new Promise(function (resolve) {
      _this.client.zrangebyscore(args, function (err, data) { return resolve(data); });
    });
  };
  Redis.prototype.zrevrange = function (args) {
    var _this = this;
    return new Promise(function (resolve) {
      _this.client.zrevrange(args, function (err, data) { return resolve(data); });
    });
  };
  Redis.prototype.zrange = function (args) {
    var _this = this;
    return new Promise(function (resolve) {
      _this.client.zrange(args, function (err, data) { return resolve(data); });
    });
  };
  Redis.prototype.zscore = function (args) {
    var _this = this;
    return new Promise(function (resolve) {
      _this.client.zscore(args, function (err, data) { return resolve(data); });
    });
  };
  Redis.prototype.zrem = function (args) {
    var _this = this;
    return new Promise(function (resolve) {
      return _this.client.zrem(args, function (err, data) { return resolve(data); });
    });
  };
  return Redis;
})();
module.exports = Redis;
