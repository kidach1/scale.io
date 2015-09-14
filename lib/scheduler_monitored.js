var io = require('socket.io').listen(port, { 'destroy buffer size': Infinity });
var log = require('./log');
var port = process.env.NODE_SERVER_TYPE === 'lobby' ? 9200 : 9300;
var config = require('config');
log.schedulerMonitor.info('scheduler_monitored server listening on port ' + port + ' ..');

io.sockets.on('connection', (socket) => {
  socket.on('DO_YOU_ALIVE', () => {
    socket.emit('IM_ALIVE');
  });
});
