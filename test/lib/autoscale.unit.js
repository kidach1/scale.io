var mocha = require('mocha');
var should = require('should');
var sinon = require('sinon');
var moment = require('moment');
var Autoscale = require('../../lib/autoscale');

describe('autoscale', () => {
  beforeEach(() => {
    this.autoscale = new Autoscale("lobby");
  });

  describe('_getOddAttributes', () => {
    it('', () => {
      var ipAndConnNumsStr = ['ec2-11-11-11-11', '1', 'ec2-11-11-11-11', '2', 'ec2-11-11-11-11', '3'];
      var res = this.autoscale._getOddAttributes(ipAndConnNumsStr);
      res.should.eql(['1', '2', '3']);
    });
  });

  describe('_parseInt4Arr', () => {
    it('', () => {
      var connNumsStr = ['1', '2', '3'];
      var res = this.autoscale._parseInt4Arr(connNumsStr);
      res.should.eql([1, 2, 3]);
    });
  });

  describe('_greenHostsFrom', () => {
    it('', () => {
      var connNums = [1, 2, 3, 999999];
      var res = this.autoscale._greenHostsFrom(connNums);
      res.should.eql([1, 2, 3]);
    });
  });

  describe('_checkByMinimumHostNum', () => {
    it('is under minimum num', () => {
      var connNumsOfGreenHosts = [1, 2];
      var res = this.autoscale._checkByMinimumHostNum(connNumsOfGreenHosts);
      res.should.eql(true);
    });
    it('is over minimum num', () => {
      var connNumsOfGreenHosts = [1, 2, 3];
      var res = this.autoscale._checkByMinimumHostNum(connNumsOfGreenHosts);
      res.should.eql(false);
    });
  });

  describe('_sumFrom', () => {
    it('', () => {
      var connNums = [1, 2, 3];
      var res = this.autoscale._sumFrom(connNums);
      res.should.eql(6);
    });
  });

  describe('_connNumsOfHavingConnsHostsFrom', () => {
    it('', () => {
      var connNums = [1, 2, 3];
      var res = this.autoscale._connNumsOfHavingConnsHostsFrom(connNums);
      res.should.eql([2, 3]);
    });
  });

  describe('_roomFrom', () => {
    it('', () => {
      var connNumsOfhavingConnsHosts = [2, 3, 4, 5];
      var res = this.autoscale._roomFrom(connNumsOfhavingConnsHosts);
      res.should.eql(2);
    });
  });

  describe('_isScalableTime', () => {
    // TODO: use stub for moment.
    it('', () => {
      var res = this.autoscale._isScalableTime(10, 12);
      res.should.eql(false);
    });
  });

  describe('_newHostNumForScaleOut', function() {
    it('', function() {
      var res = this.autoscale._newHostNumForScaleOut(35);
      res.should.eql(100);
    });
    it('', function() {
      var res = this.autoscale._newHostNumForScaleOut(195);
      res.should.eql(300);
    });
    it('', () => {
      var res = this.autoscale._newHostNumForScaleOut(305);
      res.should.eql(500);
    });
  });

  describe('_newHostNumForScaleIn', () => {
    it('', () => {
      var res = this.autoscale._newHostNumForScaleIn(250);
      res.should.eql(200);
    });
    it('', () => {
      var res = this.autoscale._newHostNumForScaleIn(100);
      res.should.eql(80);
    });
    it('', () => {
      var res = this.autoscale._newHostNumForScaleIn(78);
      res.should.eql(60);
    });
  });
});
