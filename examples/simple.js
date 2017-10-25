//var gps = require("gps-tracking");
var gps = require('../index');

var options = {
  debug: true,
  port: 8090,
  device_adapter: 'TK103B'
}

var server = gps.server(options, function (device, connection) {

  device.on('login_request', function (device_id, msg_parts) {
    // Some devices sends a login request before transmitting their position
    // Do some stuff before authenticate the device...

    // Accept the login request. You can set false to reject the device.
    this.login_authorized(true)

  })

  //PING -> When the gps sends their position
  device.on('ping', function (data) {

    //After the ping is received, but before the data is saved
    //console.log(data);
    return data

  });

});

server.setDebug(true);
