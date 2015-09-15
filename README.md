# scale.io

loadbalancing and autoscaling module for websocket based EC2 cluster.

### architecture

- **no ELB**

![architecture](https://qiita-image-store.s3.amazonaws.com/0/48274/610eba46-c978-20ec-f4b0-6c417c4057df.png)

- slack based monitoring

![monitoring1](https://qiita-image-store.s3.amazonaws.com/0/48274/52c80652-0b9b-ddbe-7f89-719bac52a93c.png)

![monitoring2](https://qiita-image-store.s3.amazonaws.com/0/48274/8903e145-86ef-9f17-7bb9-2863f87a9f61.png)


- zero downtime deploy
- multi-AZ based
- auto fail over

wip



# how to use


## scale.js

```js
require('scale.io');
```

## set config yml file

set `config/default.yaml` or `config/env.yaml` your main app.

Example is [this](https://github.com/kidach1/scale.io/blob/master/config/default.yaml.example).

## execute

```
node --harmony scale.js
```

## config details


#### conf for redis

enter your redis host & port.


#### conf for aws

enter your access key id, secret access key and region.


#### conf for slack

enter your slack info.


#### conf for loadbalancing / autoscaling / monitoring

enter info (details are here).


#### conf for loadbalancing

wip.

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
