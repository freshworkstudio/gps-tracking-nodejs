util			= require('util');
EventEmitter	= require('events').EventEmitter;
net				= require('net');
extend			= require('node.extend');
functions		= require('./functions');

util.inherits(Device, EventEmitter);
util.inherits(server, EventEmitter);

function server(opts, callback) {
	if (!(this instanceof server))
		return new server(opts, callback);
	EventEmitter.call(this);
	var defaults = {
		debug:						false,
		port:						8080,
		device_adapter:				false
	};

	//Merge default options with user options
	this.opts = extend(defaults, opts);

	var thisServer = this;
	this.devices = [];
	this.db = false;

	this.server = false;
	this.availableAdapters = {
		TK103:		'./adapters/tk103'
	};

	/****************************
	SOME FUNCTIONS
	*****************************/
	/* */
	this.setAdapter = function(adapter){
		if (typeof adapter.adapter != 'function')
			throw 'The adapter needs an adpater() method to start an instance of it';
		this.device_adapter = adapter;
	};

	this.getAdapter = function() {
		return this.device_adapter;
	};

	this.addAdaptar = function(model, Obj) {
		this.availableAdapters.push(model);
	};

	this.init = function(cb) {
		//Set debug
		thisServer.setDebug(this.opts.debug);

		/*****************************
		DEVICE ADAPTER INITIALIZATION
		******************************/
		if (thisServer.opts.device_adapter === false)
			throw 'The app don\'t set the device_adapter to use. Which model is sending data to this server?';

		if (typeof thisServer.opts.device_adapter == 'string') {

			//Check if the selected model has an available adapter registered
			if (typeof this.availableAdapters[this.opts.device_adapter] == 'undefined')
				throw 'The class adapter for ' + this.opts.device_adapter + ' doesn\'t exists';

			//Get the adapter
			var adapterFile = (this.availableAdapters[this.opts.device_adapter]);

			this.setAdapter(require(adapterFile));

		} else {
			//IF THE APP PASS THE ADEPTER DIRECTLY
			thisServer.setAdapter(this.opts.device_adapter);
		}

		thisServer.emit('before_init');
		if (typeof cb == 'function') cb();
		thisServer.emit('init');

		/* FINAL INIT MESSAGE */
		console.log('\n=================================================\nFRESHWORK GPS LISTENER running at port ' + thisServer.opts.port + '\nEXPECTING DEVICE MODEL:  ' + thisServer.getAdapter().model_name + '\n=================================================\n');
	};

	this.addAdaptar = function(model,Obj){
		this.adapters.push(model);
	};

	this.do_log = function (msg,from){
		//If debug is disabled, return false
		if(this.getDebug() === false)return false;

		//If from parameter is not set, default is server.
		if(typeof(from) == "undefined")from = "SERVER";

		msg = "#" + from + ": " + msg;
		console.log(msg);

	};

	/****************************************
	SOME SETTERS & GETTERS
	****************************************/
	this.setDebug = function(val){
		this.debug = (val === true);
	};

	this.getDebug = function(){
		return this.debug;
	};



	//Init app
	this.init(function(){
		/*************************************
		AFTER INITIALIZING THE APP...
		*************************************/
		thisServer.server = net.createServer(function (connection) {
			//Now we are listening!

			//We create an new device and give the an adapter to parse the incomming messages
			connection.device = new Device(thisServer.getAdapter(),connection,thisServer);
			thisServer.devices.push(connection);


			//Once we receive data...
			connection.on('data', function (data) {
				connection.device.emit("data",data);
			});

			// Remove the device from the list when it leaves
			connection.on('end', function () {
				thisServer.devices.splice(thisServer.devices.indexOf(connection), 1);
				connection.device.emit("disconnected");
			});

			callback(connection.device,connection);

			connection.device.emit('connected');
		}).listen(opts.port);
	});

	/* Search a device by ID */
	this.find_device = function(device_id){
		for(var i in this.devices){
			var dev = this.devices[i].device;
			if(dev.uid == device_id)return dev;
		}
		return false;
	};

	/* SEND A MESSAGE TO DEVICE ID X */
	this.send_to = function(device_id,msg){
		var dev = this.find_device(device_id);
		dev.send(msg);
	};

	return this;
}



/*************************************************************

                    THE DEVICE CLASS
**************************************************************/

function Device(adapter,connection,gps_server){
	/* Inherits EventEmitter class */
	EventEmitter.call(this);

	var this_device 	= this;

	this.connection 	= connection;
	this.server 		= gps_server;
	this.adapter		= adapter.adapter(this);

	this.uid = false;
	this.ip = connection.ip;
	this.port = connection.port;
	this.name = false;
	this.loged = false;


	init();
	/* init */
	function init(){

	}

	/****************************************
	RECEIVING DATA FROM THE DEVICE
	****************************************/
	this.on("data",function(data) {
		msg_parts = this_device.adapter.parse_data(data);

		if(this.getUID() === false && typeof(msg_parts.device_id) == "undefined"){
			throw "The adapter doesn't return the device_id and is not defined";
		}

		if(msg_parts === false) { //something bad happened
			this_device.do_log("The message (" + data + ") can't be parsed. Discarding...");
			return;
		}

		if(typeof(msg_parts.cmd) == "undefined")throw "The adapter doesn't return the command (cmd) parameter";

		//If the UID of the devices it hasn't been setted, do it now.
		if(this.getUID() === false)
			this.setUID(msg_parts.device_id);

		/************************************
		EXECUTE ACTION
		************************************/
		this_device.make_action(msg_parts.action,msg_parts);
	});

	this.make_action = function(action, msg_parts) {
		//If we're not loged
		if(action != "login_request" && !this_device.loged){
			this_device.adapter.request_login_to_device();
			console.log(this_device.getUID()+" is trying to '" + action + "' but it isn't loged. Action wasn't executed");
			return false;
		}
		switch(action){
			case "login_request":
				this_device.login_request(msg_parts);
				break;
			case "ping":
				this_device.ping(msg_parts);
				break;
			case "alarm":
				this_device.receive_alarm(msg_parts);
				break;
			case "other":
				this_device.adapter.run_other(msg_parts.cmd,msg_parts);
				break;
		}
	};



	/****************************************
	LOGIN & LOGOUT
	****************************************/
	this.login_request = function(msg_parts) {
		this_device.do_log("I'm requesting to be loged.");
		this_device.emit("login_request",this.getUID(),msg_parts);
	};
	this.login_authorized = function(val, msg_parts) {
		if(val){
			this.do_log("Device " + this_device.getUID() + " has been authorized. Welcome!");
			this.loged = true;
			this.adapter.authorize(msg_parts);
		}else{
			this.do_log("Device " + this_device.getUID() + " not authorized. Login request rejected");
		}
	};
	this.logout = function(){
		this.loged = false;
		this.adapter.logout();
	};


	/****************************************
	RECEIVING GPS POSITION FROM THE DEVICE
	****************************************/
	this.ping = function(msg_parts){
		var gps_data = this.adapter.get_ping_data(msg_parts);
		if(gps_data === false){
			//Something bad happened
			this_device.do_log("GPS Data can't be parsed. Discarding packet...");
			return false;
		}

		/* Needs:
		latitude, longitude, time
		Optionals:
		orientation, speed, mileage, etc */

		this_device.do_log("Position received ( " + gps_data.latitude + "," + gps_data.longitude + " )");

		gps_data.inserted=new Date();
		gps_data.from_cmd = msg_parts.cmd;
		this_device.emit("ping", gps_data);


	};

	/****************************************
	RECEIVING ALARM
	****************************************/
	this.receive_alarm = function(msg_parts) {
		//We pass the message parts to the adapter and they have to say wich type of alarm it is.
		var alarm_data = this_device.adapter.receive_alarm(msg_parts);
		/* Alarm data must return an object with at least:
		alarm_type: object with this format:
			{'code':'sos_alarm','msg':'SOS Alarm activated by the driver'}
		*/
		this_device.emit("alarm", alarm_data.code, alarm_data, msg_parts);
	};


	/****************************************
	SET REFRESH TIME
	****************************************/
	this.set_refresh_time = function(interval, duration) {
		this_device.adapter.set_refresh_time(interval, duration);
	};

	/* adding methods to the adapter */
	this.adapter.get_device = function(){
		return device;
	};
	this.send = function(msg){
		this.emit("send_data",msg);
		this.connection.write(msg);
		this.do_log("Sending to "+this_device.getUID() + ": " + msg);
	};

	this.do_log = function (msg){
		this_device.server.do_log(msg,this_device.getUID());
	};

	this.send_byte_array = function(array){
		this.emit("send_byte_data",array);
		var buff = new Buffer(array);
		console.log(buff);
		this.do_log("Sending to " + this_device.uid + ": <Array: [" + array + "]>");
	};

	/****************************************
	SOME SETTERS & GETTERS
	****************************************/
	this.getName = function(){
		return this.name;
	};
	this.setName = function(name) {
		this.name = name;
	};

	this.getUID = function() {
		return this.uid;
	};
	this.setUID = function(uid) {
		this.uid = uid;
	};

}


exports.server = server;
exports.version = require('../package').version;
