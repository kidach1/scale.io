var mocha = require('mocha');
var should = require('should');
var sinon = require('sinon');
var ServerStatus = require('../../lib/server_status');

describe('server_status', () => {
  beforeEach(() => {
    this.server_status = new ServerStatus("lobby", 9000);
  });

  describe('_pickupHostName', () => {
    it('has response corresponding lobby tag', () => {
      var ec2DescribeInstancesResponse = {
        Reservations: [
          {
            ReservationId: 'r-62878c91',
            OwnerId: '726951806979',
            Groups: [],
            Instances: [
              {
                PublicDnsName: 'ec2-11-11-11-11.ap-northeast-1.compute.amazonaws.com',
                Tags: [
                  { Key: 'aws:cloudformation:logical-id', Value: 'Realtime51' },
                  { Key: 'Name', Value: 'prod-realtime-lobby' }
                ]
              }
            ]
          }
        ]
      };
      return this.server_status._pickupHostName(ec2DescribeInstancesResponse).then((res) => {
        res.should.eql(['ec2-11-11-11-11']);
      });
    });
    it('does not have response corresponding lobby tag', () => {
      var ec2DescribeInstancesResponse = {
        Reservations: [
          {
            ReservationId: 'r-62878c91',
            OwnerId: '726951806979',
            Groups: [],
            Instances: [
              {
                PublicDnsName: 'ec2-11-11-11-11.ap-northeast-1.compute.amazonaws.com',
                Tags: [
                  { Key: 'aws:cloudformation:logical-id', Value: 'Realtime51' }
                ]
              }
            ]
          }
        ]
      };
      return this.server_status._pickupHostName(ec2DescribeInstancesResponse).then((res) => {
        res.should.eql([]);
      });
    });
  });
});
