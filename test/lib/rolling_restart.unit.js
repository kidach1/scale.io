var mocha = require('mocha');
var should = require('should');
var sinon = require('sinon');
var RollingRestart = require('../../lib/rolling_restart');

describe('rolling_restart', () => {
  beforeEach(() => {
    this.rolling_restart = new RollingRestart("lobby");
  });
  before(() => {
    this.ec2DescribeTagsResponse = {
      Tags: [
        {
          ResourceId: 'i-1111111',
          ResourceType: 'instance',
          Key: 'aws:cloudformation:logical-id',
          Value: 'RealTime1' },
        { ResourceId: 'i-1111111',
          ResourceType: 'instance',
          Key: 'restartGroup',
          Value: 'groupA' },
        { ResourceId: 'i-1111111',
          ResourceType: 'instance',
          Key: 'Name',
          Value: 'prod-realtime-lobby' }
      ]
    };
  });

  describe('_isRestartGroup', () => {
    it('has response corresponding restart group tag', () => {
      var instanceId = 'i-1111111';
      var restartGroupTag = 'groupA';
      var res = this.rolling_restart._isRestartGroup(this.ec2DescribeTagsResponse, instanceId, restartGroupTag);
      res.should.eql(true);
    });
    it('does not have response corresponding restart group tag', () => {
      var instanceId = 'i-1111111';
      var restartGroupTag = 'groupB';
      var res = this.rolling_restart._isRestartGroup(this.ec2DescribeTagsResponse, instanceId, restartGroupTag);
      res.should.eql(false);
    });
  });

  describe('_getServerTypeTag', () => {
    it('has response corresponding restart group tag', () => {
      var instanceId = 'i-1111111';
      var res = this.rolling_restart._getServerTypeTag(this.ec2DescribeTagsResponse, instanceId);
      res.should.eql('prod-realtime-lobby');
    });
    it('does not have response corresponding restart group tag', () => {
      var instanceId = 'i-2222222';
      var restartGroupTag = 'groupB';
      var res = this.rolling_restart._getServerTypeTag(this.ec2DescribeTagsResponse, instanceId);
      res.should.eql(false);
    });
  });
});
