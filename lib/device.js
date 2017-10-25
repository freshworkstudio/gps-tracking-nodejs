util = require('util');
EventEmitter = require('events').EventEmitter;
util.inherits(Device, EventEmitter);

function Device(adapter, connection, gpsServer) {
  /* Inherits EventEmitter class */
  EventEmitter.call(this);

  var thisDevice = this;

  this.connection = connection;
  this.server = gpsServer;
  this.adapter = adapter.adapter(this);

  this.id = false;
  this.ip = connection.ip;
  this.port = connection.port;
  this.name = false;
  this.loged = false;

  init();
  /* init */
  function init() {

  }

  /****************************************
   RECEIVING DATA FROM THE DEVICE
   ****************************************/
  this.on('data', function (data) {
    var msg_parts = thisDevice.adapter.parse_data(data);

    if (this.getUID() === false && typeof (msg_parts.device_id) === 'undefined') {
      throw 'The adapter doesn\'t return the device_id and is not defined';
    }

    if (msg_parts === false) { //something bad happened
      thisDevice.do_log('The message (' + data + ') can\'t be parsed. Discarding...');
      return;
    }

    if (typeof (msg_parts.cmd) === 'undefined') {
      throw 'The adapter doesn\'t return the command (cmd) parameter';
    }

    //If the UID of the devices it hasn't been setted, do it now.
    if (this.getUID() === false)
      this.setUID(msg_parts.device_id);

    /************************************
     EXECUTE ACTION
     ************************************/
    thisDevice.make_action(msg_parts.action, msg_parts);
  });

  this.make_action = function (action, msg_parts) {
    //If we're not loged
    if (action !== 'login_request' && !thisDevice.loged) {
      thisDevice.adapter.request_login_to_device();
      console.log(thisDevice.getUID() + ' is trying to \'' + action + '\' but it isn\'t loged. Action wasn\'t executed');
      return false;
    }

    switch (action) {
      case 'login_request':
        thisDevice.login_request(msg_parts);
        break;
      case 'ping':
        thisDevice.ping(msg_parts);
        break;
      case 'alarm':
        thisDevice.receive_alarm(msg_parts);
        break;
      case 'other':
        thisDevice.adapter.run_other(msg_parts.cmd, msg_parts);
        break;
    }
  };

  /****************************************
   LOGIN & LOGOUT
   ****************************************/
  this.login_request = function (msg_parts) {
    thisDevice.do_log('I\'m requesting to be loged.');
    thisDevice.emit('login_request', this.getUID(), msg_parts);
  };

  this.login_authorized = function (val, msg_parts) {
    if (val) {
      this.do_log('Device ' + thisDevice.getUID() + ' has been authorized. Welcome!');
      this.loged = true;
      this.adapter.authorize(msg_parts);
    } else {
      this.do_log('Device ' + thisDevice.getUID() + ' not authorized. Login request rejected');
    }
  };

  this.logout = function () {
    this.loged = false;
    this.adapter.logout();
  };

  /****************************************
   RECEIVING GPS POSITION FROM THE DEVICE
   ****************************************/
  this.ping = function (msg_parts) {
    var gps_data = this.adapter.get_ping_data(msg_parts);
    if (gps_data === false) {
      //Something bad happened
      thisDevice.do_log('GPS Data can\'t be parsed. Discarding packet...');
      return false;
    }

    /* Needs:
     latitude, longitude, time
     Optionals:
     orientation, speed, mileage, etc */

    thisDevice.do_log('Position received ( ' + gps_data.latitude + ',' + gps_data.longitude + ' )');
    gps_data.from_cmd = msg_parts.cmd;
    thisDevice.emit('ping', gps_data, msg_parts);

  };

  /****************************************
   RECEIVING ALARM
   ****************************************/
  this.receive_alarm = function (msg_parts) {
    //We pass the message parts to the adapter and they have to say wich type of alarm it is.
    var alarm_data = thisDevice.adapter.receive_alarm(msg_parts);
    /* Alarm data must return an object with at least:
     alarm_type: object with this format:
     {'code':'sos_alarm','msg':'SOS Alarm activated by the driver'}
     */
    thisDevice.emit('alarm', alarm_data.code, alarm_data, msg_parts);
  };

  /****************************************
   SET REFRESH TIME
   ****************************************/
  this.set_refresh_time = function (interval, duration) {
    thisDevice.adapter.set_refresh_time(interval, duration);
  };

  /* adding methods to the adapter */
  this.adapter.get_device = function () {
    return device;
  };

  this.send = function (msg) {
    this.emit('send_data', msg);
    this.connection.write(msg);
    this.do_log('Sending to ' + thisDevice.getUID() + ': ' + msg);
  };

  this.do_log = function (msg) {
    thisDevice.server.do_log(msg, thisDevice.getUID());
  };

  this.send_byte_array = function (array) {
    this.emit('send_byte_data', array);
    var buff = new Buffer(array);
    console.log(buff);
    this.do_log('Sending to ' + thisDevice.uid + ': <Array: [' + array + ']>');
  };

  /****************************************
   SOME SETTERS & GETTERS
   ****************************************/
  this.getName = function () {
    return this.name;
  };

  this.setName = function (name) {
    this.name = name;
  };

  this.getUID = function () {
    return this.uid;
  };

  this.setUID = function (uid) {
    this.uid = uid;
  };

}
