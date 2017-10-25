/* Original code: https://github.com/cnberg/gps-tracking-nodejs/blob/master/lib/adapters/gt02a.js */
f = require('../functions');

exports.protocol = 'GT02A';
exports.model_name = 'GT02A';
exports.compatible_hardware = ['GT02A/supplier'];

var adapter = function (device) {
  if (!(this instanceof adapter)) {
    return new adapter(device);
  }

  this.format = {'start': '(', 'end': ')', 'separator': ''};
  this.device = device;
  this.__count = 1;

  /*******************************************
   PARSE THE INCOMING STRING FROM THE DECIVE
   You must return an object with a least: device_id, cmd and type.
   return device_id: The device_id
   return cmd: command from the device.
   return type: login_request, ping, etc.
   *******************************************/
  this.parse_data = function (data) {
    data = this.bufferToHexString(data);
    console.log(data);
    var parts = {
      'start': data.substr(0, 4)
    };

    if (parts['start'] == '6868') {
      parts['length'] = parseInt(data.substr(4, 2), 16);
      parts['finish'] = data.substr(parts['length'] * 2 + 6, 4);

      if (parts['finish'] != '0d0a') {
        throw 'finish code incorrect!';
      }
      parts['power'] = parseInt(data.substr(6, 2), 16);
      parts['gsm'] = parseInt(data.substr(8, 2), 16);
      parts['device_id'] = data.substr(10, 16);
      parts['count'] = data.substr(26, 4);
      parts['protocal_id'] = data.substr(30, 2);

      parts['data'] = data.substr(32, parts['length']);

      if (parts['protocal_id'] == '1a') {
        parts.cmd = 'login_request';
        parts.action = 'login_request';
      } else if (parts['protocal_id'] == '10') {
        parts.cmd = 'ping';
        parts.action = 'ping';
      } else {
        parts.cmd = 'noop';
        parts.action = 'noop';
      }
    } else if (parts['start'] == '7979') {
      parts['length'] = parseInt(data.substr(4, 4), 16);
      parts['finish'] = data.substr(8 + parts['length'] * 2, 4);

      parts['protocal_id'] = data.substr(8, 2);

      if (parts['finish'] != '0d0a') {
        throw 'finish code incorrect!';
      }

      if (parts['protocal_id'] == '94') {
        parts['device_id'] = '';
        parts.cmd = 'noop';
        parts.action = 'noop';
      }

    } else if (parts['start'] == '7878') {
      parts['length'] = parseInt(data.substr(4, 2), 16);
      parts['finish'] = data.substr(6 + parts['length'] * 2, 4);

      parts['protocal_id'] = data.substr(6, 2);

      if (parts['finish'] != '0d0a') {
        throw 'finish code incorrect!';
      }

      if (parts['protocal_id'] == '8a') {
        parts['device_id'] = '';
        parts.cmd = 'clock';
        parts.action = 'clock';
      } else {
        parts['device_id'] = '';
        parts.cmd = 'noop';
        parts.action = 'noop';
      }
    }
    return parts;
  };
  this.bufferToHexString = function (buffer) {
    var str = '';
    for (var i = 0; i < buffer.length; i++) {
      if (buffer[i] < 16) {
        str += '0';
      }
      str += buffer[i].toString(16);
    }
    return str;
  };
  this.authorize = function () {
    this.send_comand('\u0054\u0068\u001a\u000d\u000a');
  };
  this.zeroPad = function (nNum, nPad) {
    return ('' + (Math.pow(10, nPad) + nNum)).slice(1);
  };
  this.synchronous_clock = function () {
    var d = new Date();

    var str = (d.getFullYear().toString().substr(2, 2)) +
      (this.zeroPad(d.getMonth() + 1, 2).toString()) +
      (this.zeroPad(d.getDate(), 2).toString()) +
      (this.zeroPad(d.getHours(), 2).toString()) +
      (this.zeroPad(d.getMinutes(), 2).toString()) +
      (this.zeroPad(d.getSeconds(), 2).toString()) +
      (this.zeroPad(this.__count, 4).toString());

    this.__count++;

    var crc = require('/usr/lib/node_modules/crc/lib/index.js');
    var crcResult = f.str_pad(crc.crc16(str).toString(16), 4, '0');

    var buff = new Buffer(str + crcResult, 'hex');
    this.send_comand('7878', buff);
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
    //My device have no support of this feature
    return alarm;
  };

  this.dex_to_degrees = function (dex) {
    return parseInt(dex, 16) / 1800000;
  };

  this.get_ping_data = function (msg_parts) {
    var str = msg_parts.data;

    var data = {
      'date': str.substr(0, 12),
      'latitude': this.dex_to_degrees(str.substr(12, 8)),
      'longitude': this.dex_to_degrees(str.substr(20, 8)),
      'speed': parseInt(str.substr(28, 2), 16),
      'orientation': str.substr(30, 4),
    };

    res = {
      latitude: data.latitude,
      longitude: data.longitude,
      speed: data.speed,
      orientation: data.orientation
    };
    return res;
  };

  /* SET REFRESH TIME */
  this.set_refresh_time = function (interval, duration) {
  };

  /* INTERNAL FUNCTIONS */

  this.send_comand = function (cmd, data) {
    var msg = [cmd, data];
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
};
exports.adapter = adapter;