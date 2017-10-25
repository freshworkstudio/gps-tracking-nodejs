util = require('util');
EventEmitter = require('events').EventEmitter;
util.inherits(Device, EventEmitter);

function Device(adapter, connection, gpsServer) {
  /* Inherits EventEmitter class */
  EventEmitter.call(this);

  var _this = this;

  this.connection = connection;
  this.server = gpsServer;
  this.adapter = adapter.adapter(this);

  this.uid = false;
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
    var msgParts = _this.adapter.parse_data(data);

    if (this.getUID() === false && typeof (msgParts.device_id) === 'undefined') {
      throw 'The adapter doesn\'t return the device_id and is not defined';
    }

    if (msgParts === false) { //something bad happened
      _this.do_log('The message (' + data + ') can\'t be parsed. Discarding...');
      return;
    }

    if (typeof (msgParts.cmd) === 'undefined') {
      throw 'The adapter doesn\'t return the command (cmd) parameter';
    }

    //If the UID of the devices it hasn't been setted, do it now.
    if (this.getUID() === false) {
      this.setUID(msgParts.device_id);
    }

    /************************************
     EXECUTE ACTION
     ************************************/
    _this.make_action(msgParts.action, msgParts);
  });

  this.make_action = function (action, msgParts) {
    //If we're not loged
    if (action !== 'login_request' && !_this.loged) {
      _this.adapter.request_login_to_device();
      _this.do_log(_this.getUID() + ' is trying to \'' + action + '\' but it isn\'t loged. Action wasn\'t executed');
      return false;
    }

    switch (action) {
      case 'login_request':
        _this.login_request(msgParts);
        break;
      case 'ping':
        _this.ping(msgParts);
        break;
      case 'alarm':
        _this.receive_alarm(msgParts);
        break;
      case 'other':
        _this.adapter.run_other(msgParts.cmd, msgParts);
        break;
    }
  };

  /****************************************
   LOGIN & LOGOUT
   ****************************************/
  this.login_request = function (msgParts) {
    _this.do_log('I\'m requesting to be loged.');
    _this.emit('login_request', this.getUID(), msgParts);
  };

  this.login_authorized = function (val, msgParts) {
    if (val) {
      this.do_log('Device ' + _this.getUID() + ' has been authorized. Welcome!');
      this.loged = true;
      this.adapter.authorize(msgParts);
    } else {
      this.do_log('Device ' + _this.getUID() + ' not authorized. Login request rejected');
    }
  };

  this.logout = function () {
    this.loged = false;
    this.adapter.logout();
  };

  /****************************************
   RECEIVING GPS POSITION FROM THE DEVICE
   ****************************************/
  this.ping = function (msgParts) {
    var gpsData = this.adapter.get_ping_data(msgParts);
    if (gpsData === false) {
      //Something bad happened
      _this.do_log('GPS Data can\'t be parsed. Discarding packet...');
      return false;
    }

    /* Needs:
     latitude, longitude, time
     Optionals:
     orientation, speed, mileage, etc */

    _this.do_log('Position received ( ' + gpsData.latitude + ',' + gpsData.longitude + ' )');
    gpsData.from_cmd = msgParts.cmd;
    _this.emit('ping', gpsData, msgParts);

  };

  /****************************************
   RECEIVING ALARM
   ****************************************/
  this.receive_alarm = function (msgParts) {
    //We pass the message parts to the adapter and they have to say wich type of alarm it is.
    var alarmData = _this.adapter.receive_alarm(msgParts);
    /* Alarm data must return an object with at least:
     alarm_type: object with this format:
     {'code':'sos_alarm','msg':'SOS Alarm activated by the driver'}
     */
    _this.emit('alarm', alarmData.code, alarmData, msgParts);
  };

  /****************************************
   SET REFRESH TIME
   ****************************************/
  this.set_refresh_time = function (interval, duration) {
    _this.adapter.set_refresh_time(interval, duration);
  };

  /* adding methods to the adapter */
  this.adapter.get_device = function () {
    return device;
  };

  this.send = function (msg) {
    this.emit('send_data', msg);
    this.connection.write(msg);
    this.do_log('Sending to ' + _this.getUID() + ': ' + msg);
  };

  this.do_log = function (msg) {
    _this.server.do_log(msg, _this.getUID());
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

module.exports =  Device;
