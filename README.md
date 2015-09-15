# scale.io

loadbalancing and autoscaling module for websocket based EC2 cluster.

- **no ELB** loadbalancing & autoscaling

# how to use


## scale.js

```js
require('scale.io');
```

## set config yml file

set `config/default.yaml` or `config/env.yaml` your main app.

Example is [this](https://github.com/kidach1/scale.io/blob/master/config/default.yaml.example).


#### conf for redis

enter your redis host & port.


#### conf for aws

enter your access key id, secret access key and region.


#### conf for slack

enter your slack info.


#### conf for loadbalancing / autoscaling / monitoring

enter info (details are here).


## execute

```
node --harmony scale.js
```


## config details


#### conf for loadbalancing

|key|desc|
|---|---|
|timeoutThresholdForRedHost||
|connNumForRedHost||
|ec2HostTagForGame||
|intervalForAutoscalingSec||
|intervalForHostInfoUpdateSec||
|redisKeyForLobbyLoadbalancing||
|redisKeyForGameLoadbalancing||


#### conf for autoscaling

|key|desc|
|---|---|
|restartCmd||
|cfnStackName||
|serverTypeNum||
|scaleOutThreshold||
|scaleInThreshold||
|cfnUpdateCmd||
|minimumGreenHostsNum||
|forceScaleOutStartAt||
|forceScaleOutEndAt||
|scaleInAvailableStartAt||
|scaleInAvailableEndAt||
|notifyRoomNumMessage||
|scaleInMinimumIntervalSec||
|scaleOutMinimumIntervalSec||
|specifiedTimeGreenHostsNum||
|autoRestartMonitorIntervalSec||
|autoRestartCpuUsageThresholdForLB||
|autoRestartCpuUsageThresholdForApp||


#### conf for monitor

|key|desc|
|---|---|
|monitoredHost||
|monitoredProcess||
|monitoringIntervalSec||
|decisionIntervalSec||
