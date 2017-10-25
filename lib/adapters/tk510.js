/* */
var f = require('../functions');
var crc = require('crc16-ccitt-node');

exports.protocol = 'GPSTK510';
exports.model_name = 'TK510';
exports.compatible_hardware = ['TK510/supplier'];

var adapter = function (device) {
  if (!(this instanceof adapter)) return new adapter(device);

  this.format = {'start': '(', 'end': ')', 'separator': ''};
  this.device = device;

  /*******************************************
   PARSE THE INCOMING STRING FROM THE DECIVE
   You must return an object with a least: device_id, cmd and type.
   return device_id: The device_id
   return cmd: command from the device.
   return type: login_request, ping, etc.
   *******************************************/
  this.parse_data = function (data) {
    var parts = {
      'device_id': data.toString('hex').substr(8, 14).replace(/f*$/, ''),//mandatory
      'cmd': data.toString('hex').substr(22, 4), //mandatory
      'data': data.toString('hex').substr(26).slice(0, -8),
    };
    this.device_id_complete = data.toString('hex').substr(8, 14);
    switch (parts.cmd) {
      case '5000':
        parts.action = 'login_request';
        break;
      case '9955':
        parts.action = 'ping';
        break;
      case '9999':
        parts.action = 'alarm';
        break;
      default:
        parts.action = 'other';
    }

    return parts;
  };
  this.authorize = function () {
    this.send_comand('4000', '01');
  };
  this.run_other = function (cmd, msg_parts) {
    switch (cmd) {
      case 'BP00': //Handshake
        this.device.send(this.format_data(this.device.uid + 'AP01HSO'));
        break;
    }
  };

  this.request_login_to_device = function () {
    //@TODO: Implement this.
  };

  this.receive_alarm = function (msg_parts) {
    //@TODO: implement this

    //Maybe we can save the gps data too.
    //gps_data = msg_parts.data.substr(1);
    alarm_code = msg_parts.data.substr(0, 2);
    alarm = {code: alarm_code, data: msg_parts.data.substr(2)};
    switch (alarm_code.toString()) {
      case '01':
        alarm = {'code': 'sos', 'msg': 'Driver sends a S.O.S.'};
        break;
      case '50':
        alarm = {'code': 'power_off', 'msg': 'Vehicle Power Off'};
        break;
      case '71':
        alarm = {'code': 'accident', 'msg': 'The vehicle suffers an acciden'};
        break;
      case '05':
        alarm = {'code': 'alarming', 'msg': 'The alarm of the vehicle is activated'};
        break;
      case '11':
        alarm = {'code': 'overspeed', 'msg': 'Vehicle is over the max speed setted'};
        break;
      case '13':
        alarm = {'code': 'gep_fence', 'msg': 'Out of geo fence'};
        break;
    }
    //this.send_comand("AS01",alarm_code.toString());
    return alarm;
  };

  this.get_ping_data = function (msg_parts) {
    var data_parts = this.hex_to_ascii(msg_parts.data).split(',');
    var data = {
      'time': data_parts[0],
      'gps_status': data_parts[1],
      'latitude_minutes': data_parts[2],
      'latitude_orientation': data_parts[3],
      'longitude_minutes': data_parts[4],
      'longitude_orientation': data_parts[5],
      'speed': data_parts[6],
      'orientation': data_parts[7],
      'date': data_parts[8],
      'magnetic_variation': data_parts[9],
      'direction': data_parts[10],
      'checksum': data_parts[11]
    };
    var datetime = '20' + data.date.substr(0, 2) + '/' + data.date.substr(2, 2) + '/' + data.date.substr(4, 2);
    datetime += ' ' + data.time.substr(0, 2) + ':' + data.time.substr(2, 2) + ':' + data.time.substr(4, 2);
    data.datetime = new Date(datetime);
    data.latitude = f.minute_to_decimal(data.latitude_minutes, data.latitude_orientation);
    data.longitude = f.minute_to_decimal(data.longitude_minutes, data.longitude_orientation);
    return data;
  };

  /* SET REFRESH TIME */
  this.set_refresh_time = function (interval, duration) {
    //XXXXYYZZ
    //XXXX Hex interval for each message in seconds
    //YYZZ Total time for feedback
    //YY Hex hours
    //ZZ Hex minutes
    var hours = parseInt(duration / 3600);
    var minutes = parseInt((duration - hours * 3600) / 60);
    var time = f.str_pad(interval.toString(16), 4, '0') + f.str_pad(hours.toString(16), 2, '0') + f.str_pad(minutes.toString(16), 2, '0');
    this.send_comand('AR00', time);
  };

  /* INTERNAL FUNCTIONS */

  this.checksum = function (msg) {
    return crc.getCrc16(new Buffer(msg, 'hex')).toString(16);
  };

  this.send_comand = function (cmd, data) {
    if (typeof data === 'undefined') data = '';
    var l = data.length / 2 + 17;
    var msg = '4040' + this.pad_hex(l.toString(16), 4) + this.device_id_complete + cmd.substr(0, 4) + data;
    var checksum = this.checksum(msg);
    msg += checksum + '0d0a';

    var msg = new Buffer(msg, 'hex');
    this.device.send(msg);
  };

  this.pad_hex = function (string, length) {
    var str = '' + string;
    while (str.length < length) str = '0' + str;
    return str;
  };

  this.hex_to_ascii = function (str1) {
    var hex = str1.toString();
    var str = '';
    for (var n = 0; n < hex.length; n += 2) {
      str += String.fromCharCode(parseInt(hex.substr(n, 2), 16));
    }
    return str;
  };

};
exports.adapter = adapter;
