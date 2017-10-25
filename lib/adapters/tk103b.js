/* Orignal code: https://github.com/Jefersonblc/gps-tracking-nodejs/blob/master/lib/adapters/tk103b.js */
f = require('../functions');

exports.protocol = 'GPS103b';
exports.model_name = 'TK103b';
exports.compatible_hardware = ['TK103b/supplier'];

var adapter = function (device) {
  if (!(this instanceof adapter)) return new adapter(device);

  this.format = {
    'start': '**',
    'end': ';',
    'separator': ','
  };
  this.device = device;

  /*******************************************
   PARSE THE INCOMING STRING FROM THE DECIVE
   You must return an object with a least: device_id, cmd and type.
   return device_id: The device_id
   return cmd: command from the device.
   return type: login_request, ping, etc.
   *******************************************/
  this.parse_data = function (data) {
    data = data.toString();
    parts = data.split(this.format.separator);
    var data_obj = {
      'start': parts[0],
      'device_id': parts[0].replace('imei:', ''),//mandatory
      'cmd': parts[1], //mandatory
      'data': data,
      'finish': parts[parts.length - 1];
  }
    ;
    switch (data_obj.cmd) {
      case 'tracker':
        data_obj.action = 'ping';
        break;
      case 'help me':
        data_obj.action = 'alert';
        break;
      case 'door alarm':
        data_obj.action = 'alert';
        break;
      case 'low battery':
        data_obj.action = 'alert';
        break;
      case 'stockade':
        data_obj.action = 'alert';
        break;
      case 'move':
        data_obj.action = 'alert';
        break;
      case 'speed':
        data_obj.action = 'alert';
        break;
      //@TODO: implement more commands
      default:
        data_obj.action = 'other';
    }
    return data_obj;
  };

  this.authorize = function () {
  };

  this.run_other = function (cmd, msg_parts) {
    var data = msg_parts.data;
    if (data.search('imei:') == -1) {
      //keep-alive
      this.send_comand('ON');
    } else if (data.slice(-1) == 'A') {
      //handshake
      this.send_comand('LOAD');
    }
  };
};

this.request_login_to_device = function () {
  //@TODO: Implement this.
};

this.receive_alarm = function (msg_parts) {
  //@TODO: implement this

  //Maybe we can save the gps data too.
  //gps_data = msg_parts.data.substr(1);
  alarm_code = msg_parts.data.substr(0, 1);
  alarm = false;
  switch (alarm_code.toString()) {
    case '0':
      alarm = {'code': 'power_off', 'msg': 'Vehicle Power Off'};
      break;
    case '1':
      alarm = {'code': 'accident', 'msg': 'The vehicle suffers an acciden'};
      break;
    case '2':
      alarm = {'code': 'sos', 'msg': 'Driver sends a S.O.S.'};
      break;
    case '3':
      alarm = {'code': 'alarming', 'msg': 'The alarm of the vehicle is activated'};
      break;
    case '4':
      alarm = {'code': 'low_speed', 'msg': 'Vehicle is below the min speed setted'};
      break;
    case '5':
      alarm = {'code': 'overspeed', 'msg': 'Vehicle is over the max speed setted'};
      break;
    case '6':
      alarm = {'code': 'gep_fence', 'msg': 'Out of geo fence'};
      break;
  }
  this.send_comand('AS01', alarm_code.toString());
  return alarm;
};

this.get_ping_data = function (msg_parts) {
  var data_parts = msg_parts.data.split(this.format.separator);
  var data = {
    'date': data_parts[2],
    'availability': data_parts[4],
    'latitude': functions.minute_to_decimal(parseFloat(data_parts[7]), data_parts[8]),
    'longitude': functions.minute_to_decimal(parseFloat(data_parts[9]), data_parts.[10]),
    'speed': parseFloat(data_parts[11]),
    'time': data_parts[5],
  };
  var datetime = '20' + data.date.substr(0, 2) + '/' + data.date.substr(2, 2) + '/' + data.date.substr(4, 2);
  datetime += ' ' + data.time.substr(0, 2) + ':' + data.time.substr(2, 2) + ':' + data.time.substr(4, 2);
  data.datetime = new Date(datetime);
  res = {
    latitude: data.latitude,
    longitude: data.longitude,
    time: new Date(data.date + ' ' + data.time),
    speed: data.speed,
  };
  return res;
};

/* SET REFRESH TIME */
this.set_refresh_time = function (interval, duration = null) {
  //var time=['s','m','h'];
  this.send_comand('C', interval);
};

/* INTERNAL FUNCTIONS */

this.send_comand = function (cmd, data) {
  if (cmd == 'ON' || cmd == 'LOAD') {
    this.device.send(cmd);
  }
  var msg = ['imei:' + this.device.uid, cmd, data];
  this.device.send(this.format_data(msg));
};
this.format_data = function (params) {
  /* FORMAT THE DATA TO BE SENT */
  var str = this.format.start;
  if (typeof(params) == 'string') {
    str += params;
  } else if (params instanceof Array) {
    str += params.join(this.format.separator);
  } else {
    throw 'The parameters to send to the device has to be a string or an array';
  }
  str += this.format.end;
  return str;
};
}
exports.adapter = adapter;