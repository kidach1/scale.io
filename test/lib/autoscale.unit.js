var mocha = require('mocha');
var should = require('should');
var sinon = require('sinon');
var moment = require('moment');
var Autoscale = require('../../lib/autoscale');

describe('autoscale', () => {
  beforeEach(() => {
    this.autoscale = new Autoscale("lobby");
  });

  describe('_isBetween', () => {
    // TODO: use stub for moment.
    it('', () => {
      var res = this.autoscale._isBetween(10, 12);
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
