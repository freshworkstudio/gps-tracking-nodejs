util = require('util');
EventEmitter = require('events').EventEmitter;
net = require('net');
extend = require('node.extend');
functions = require('./functions');
Device = require('./device');
const cluster = require('cluster');
const http = require('http');
const numCPUs = require('os').cpus().length;
util.inherits(Server, EventEmitter);

function Server(opts, callback) {
  if (!(this instanceof Server)) {
    return new Server(opts, callback);
  }

  EventEmitter.call(this);
  var defaults = {
    debug: false,
    port: 8080,
    device_adapter: false,
  };

  //Merge default options with user options
  this.opts = extend(defaults, opts);

  var _this = this;
  this.devices = [];

  this.server = false;
  this.availableAdapters = {
    TK103: './adapters/tk103',
    TK510: './adapters/tk510',
    GT02A: './adapters/gt02a',
    GT06: './adapters/gt06',
  };

  /****************************
   SOME FUNCTIONS
   *****************************/
  /* */
  this.setAdapter = function (adapter) {
    if (typeof adapter.adapter !== 'function') {
      throw 'The adapter needs an adapter() method to start an instance of it';
    }

    this.device_adapter = adapter;
  };

  this.getAdapter = function () {
    return this.device_adapter;
  };

  this.addAdaptar = function (model, Obj) {
    this.availableAdapters.push(model);
  };

  this.init = function (cb) {
    //Set debug
    _this.setDebug(this.opts.debug);

    /*****************************
     DEVICE ADAPTER INITIALIZATION
     ******************************/
    if (_this.opts.device_adapter === false)
      throw 'The app don\'t set the device_adapter to use. Which model is sending data to this server?';

    if (typeof _this.opts.device_adapter === 'string') {

      //Check if the selected model has an available adapter registered
      if (typeof this.availableAdapters[this.opts.device_adapter] === 'undefined')
        throw 'The class adapter for ' + this.opts.device_adapter + ' doesn\'t exists';

      //Get the adapter
      var adapterFile = (this.availableAdapters[this.opts.device_adapter]);

      this.setAdapter(require(adapterFile));

    } else {
      //IF THE APP PASS THE ADEPTER DIRECTLY
      _this.setAdapter(this.opts.device_adapter);
    }

    _this.emit('before_init');
    if (typeof cb === 'function') cb();
    _this.emit('init');

    /* FINAL INIT MESSAGE */
    console.log('\n=================================================\nGPS LISTENER running at port ' + _this.opts.port + '\nEXPECTING DEVICE MODEL:  ' + _this.getAdapter().model_name + '\n=================================================\n');
  };

  this.addAdaptar = function (model, Obj) {
    this.adapters.push(model);
  };

  this.do_log = function (msg, from) {
    //If debug is disabled, return false
    if (this.getDebug() === false) return false;

    //If from parameter is not set, default is server.
    if (typeof from === 'undefined') {
      from = 'SERVER';
    }

    msg = '#' + from + ': ' + msg;
    console.log(msg);

  };

  /****************************************
   SOME SETTERS & GETTERS
   ****************************************/
  this.setDebug = function (val) {
    this.debug = (val === true);
  };

  this.getDebug = function () {
    return this.debug;
  };

  //Init app
  this.init(function () {
    /*************************************
     AFTER INITIALIZING THE APP...
     *************************************/
    if (cluster.isMaster) {
      console.log(`Master ${process.pid} is running`);
    
      // Fork workers.
      for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
      }
    
      cluster.on('exit', (worker, code, signal) => {
        console.log(`worker ${worker.process.pid} died`);
      });
    } else {
      // Workers can share any TCP connection
      _this.server = net.createServer(function (connection) {
        //Now we are listening!

        //We create an new device and give the an adapter to parse the incomming messages
        connection.device = new Device(_this.getAdapter(), connection, _this);
        _this.devices.push(connection);

        //Once we receive data...
        connection.on('data', function (data) {
          connection.device.emit('data', data);
        });

        // Remove the device from the list when it leaves
        connection.on('end', function () {
          _this.devices.splice(_this.devices.indexOf(connection), 1);
          connection.device.emit('disconnected');
        });

        callback(connection.device, connection);

        connection.device.emit('connected');
      }).listen(opts.port);
    
      console.log(`Worker ${process.pid} started`);
    }
  });

  /* Search a device by ID */
  this.find_device = function (deviceId) {
    for (var i in this.devices) {
      var dev = this.devices[i].device;
      if (dev.uid === deviceId) {
        return dev;
      }
    }

    return false;
  };

  /* SEND A MESSAGE TO DEVICE ID X */
  this.send_to = function (deviceId, msg) {
    var dev = this.find_device(deviceId);
    dev.send(msg);
  };

  return this;
}

exports.server = Server;
exports.version = require('../package').version;
