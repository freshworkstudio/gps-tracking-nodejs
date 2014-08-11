util         	= require("util");
EventEmitter 	= require("events").EventEmitter;
net 			= require('net');
mongodb 		= require('mongodb');
extend 			= require('node.extend');
functions 		= require('./functions');

util.inherits(Device, EventEmitter);
util.inherits(start_server, EventEmitter);

function start_server(opts,callback){
	if(!(this instanceof start_server)) return new start_server(opts,callback);
	EventEmitter.call(this);
	var defaults= {
		"port"						: 8090,
		"device_model"				: "TK103",
		"device_adapter"			: false,
		"mongodb_connection"		: false,
		"mongodb_server"			: {"host":"127.0.0.1","port":27017,"opts":{}},
		"mongo_database"			: {'name':'gps-tracking','auth':false,'user':false,'password':false},
		"mongo_tables"				: {"gps_data":"gps_data","alarms":"alarms"}
	};
	var this_server = this;
	this.opts = extend(defaults,opts);
	this.devices=[];
	this.db = false;
	this.server = false;
	this.available_adapters = {
		"TK103":'./adapters/tk103'
	};
	this.collections = {};
	
	/****************************
	SOME FUNCTIONS 
	*****************************/
	/* */
	this.set_adapter = function(adapter){
		if(typeof(adapter.adapter) != "function")
			throw "The adapter needs an adpater() method to start an instance of it";
		this.device_adapter = adapter;
	}
	this.get_adapter = function(){
		return this.device_adapter;	
	}
	this.getCollection = function(collection_name){
		return this_server.collections[collection_name];
	}
	this.addAdaptar = function(model,Obj){
		this.available_adapters.push(model);
	}
	
	
	this.init = function(cb){
		/*****************************
		DEVICE ADAPTER INITIALIZATION 
		******************************/
		if(this_server.opts.device_adapter == false)throw "The app don't set the device_adapter to use. Which model is sending data to this server?"
		
		if(typeof(this_server.opts.device_adapter) == "string"){
			//Check if the selected model has an available adapter registered
			if(typeof(this.available_adapters[this.opts.device_model]) == "undefined")
				throw "The class adapter for "+this.opts.device_model+" doesn't exists";	
			//Get the adapter
			var adapter_file = (this.available_adapters[this.opts.device_model]);
			this.set_adapter(require(adapter_file));
		}else{
			//IF THE APP PASS THE ADEPTER DIRECTLY
			this_server.set_adapter(this.opts.device_adapter);
		}
		
		
		
		/*****************************
		MONGODB INIT
		*****************************/
		if(this.opts.mongodb_connection == false){
			//Connect to MongoDB
			var server = new mongodb.Server(this_server.opts.mongodb_server.host, this_server.opts.mongodb_server.port, this_server.opts.mongodb_server.opts);
			this_server.db = new mongodb.Db(this_server.opts.mongo_database.name, server, {safe:true});
			this_server.db.open(function (error, client) {
				if (error) throw error;
				//IF WE NEED AUTHENTICATION
				if(this_server.opts.mongo_database.auth){
					do_log("Authenticating to mongodb (DB: "+this_server.opts.mongo_database.name+")...");
					this_server.db.authenticate(this_server.opts.mongo_database.user, this_server.opts.mongo_database.password, function(err, result) {
						if (error) throw error;
						if(!result)throw "Authentication failed on mongodb with username "+this_server.opts.mongo_database.user;
						else do_log("Connected to mongodb :)");
						set_collections();	
					});
				}else{
					do_log("Connected to mongodb without authentication...");
					set_collections();	
				}
				function set_collections(){
					this_server.collections = {
						'gps_data'		: new mongodb.Collection(client, this_server.opts.mongo_tables.gps_data),
						'alarms'		: new mongodb.Collection(client, this_server.opts.mongo_tables.alarms)
					}
					
					this_server.emit("before_init");
					if(typeof(cb)=="function")cb();
					this_server.emit("init");
				}
			});
		}else{
			this.db = opts.mongo_connection;	
		}
		
		/* FINAL INIT MESSAGE */
		console.log("\n=================================================\nFRESHWORK GPS LISTENER running at port "+this_server.opts.port+"\nEXPECTING DEVICE MODEL:  "+this_server.get_adapter().model_name+"\n=================================================\n");
	}
	this.init(function(){
		/*************************************
		AFTER INITIALIZING THE APP... 
		*************************************/
		this_server.server = net.createServer(function (connection) {
			//Now we are listening!
			
			connection.device = new Device(this_server.get_adapter(),connection,this_server);
			this_server.devices.push(connection);
			
			//Once we receive data...
			connection.on('data', function (data) {
				connection.device.emit("data",data);
			});
			
			// Remove the device from the list when it leaves
			connection.on('end', function () {
				this_server.devices.splice(this_server.devices.indexOf(connection), 1);
			});
			
			callback(connection.device,connection);
		}).listen(opts.port);
	});
	
	/* Search a device by ID */
	this.find_device = function(device_id){
		for(var i in this.devices){
			var dev = this.devices[i].device;
			if(dev.uid == device_id)return dev;
		}
		return false;
	}
	
	/* SEND A MESSAGE TO DEVICE ID X */
	this.send_to = function(device_id,msg){
		var dev = this.find_device(device_id);
		dev.send(msg);
	}
	return this;
}



/**************************************************************
 **************************************************************
 
                    THE DEVICE CLASS
 
 **************************************************************
 **************************************************************/

function Device(adapter,connection,gps_server){
	/* Inherits EventEmitter class */
	EventEmitter.call(this);
	
	var this_device 	= this;
	this.connection 	= connection;
	this.gps_server 	= gps_server;
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
	this.on("data",function(data){
		//data = data.toString().replace(/(\r\n|\n|\r)/gm,""); //Remove 3 type of break lines
		msg_parts = this_device.adapter.parse_data(data);
		if(msg_parts == false){ //something bad happened
			do_log("The message ("+data+") can't be parsed. Discarding...");
			return;
		}
		if(this.uid == false && typeof(msg_parts.device_id) == "undefined")
			throw "The adapter doesn't return the device_id and is not yet defined";
		if(typeof(msg_parts.cmd) == "undefined")throw "The adapter doesn't return the command (cmd) parameter";
		if(this.uid==false)this.uid = msg_parts.device_id;
		
		/************************************
		EXECUTE ACTION
		************************************/
		this_device.make_action(msg_parts.action,msg_parts);
	});
	
	this.make_action = function(action, msg_parts){
		//If we're not loged
		if(action != "login_request" && !this_device.loged){
			this_device.adapter.request_login_to_device();
			console.log(this_device.uid+" is trying to '"+action+"' but it isn't loged. Action wasn't executed");
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
	}
	
	
	
	/****************************************
	LOGIN & LOGOUT
	****************************************/
	this.login_request = function(msg_parts){
		do_log("Device "+this_device.uid+" has requested to be loged.");
		this_device.emit("login_request",this.uid,msg_parts);
	}
	this.login_authorized = function(val,msg_parts){
		if(val){
			do_log("Device "+this_device.uid+" has been authorized. Welcome!");
			this.loged = true;
			this.adapter.authorize(msg_parts);
		}else{
			do_log("Device "+this_device.uid+" not authorized. Login request rejected");
			//@TODO: Do some stuff here...	
		}
	}
	this.logout = function(){
		this.loged = false;
		this.adapter.logout();
	}
	
	/****************************************
	SAVE THE GPS DATA
	****************************************/
	this.save_gps_data = function(data,callback){
		this_device.gps_server.getCollection('gps_data').insert(data, {w: 1}, function(err, records){
			if(err)do_log("Error saving gps data: "+err);
		});	
	}
	
	/****************************************
	RECEIVING GPS POSITION FROM THE DEVICE
	****************************************/
	this.ping = function(msg_parts){
		//@TODO: Implement a way in that the app can modify the gps_data before save it in mongodb.
		var gps_data = this.adapter.get_ping_data(msg_parts);
		if(gps_data == false){
			//Something bad happened
			do_log("GPS Data can't be parsed. Discarding...");
			return false;	
		}
		/* Needs: 
		latitude, longitude, time
		Optionals: 
		orientation, speed, mileage */ 	
		gps_data.inserted=new Date()
		gps_data.from_cmd = msg_parts.cmd;
		this_device.emit("ping",gps_data);
		/*if(typeof(return_data) != "undefined"){ //If the app return an object, we modify the gps_data object to save.
			gps_data = return_data;	
		}*/
		this_device.save_gps_data(gps_data,function(){
			//before saveing the data, we emit the save_ping event
			this_device.emit("save_ping",gps_data);
		});
	}
	
	/****************************************
	RECEIVING ALARM
	****************************************/
	this.receive_alarm = function(msg_parts){
		//We pass the message parts to the adapter and they have to say wich type of alarm it is.
		var alarm_data = this_device.adapter.receive_alarm(msg_parts);
		/* Alarm data must return an object with at least: 
		alarm_type: object with this format: 
			{'code':'sos_alarm','msg':'SOS Alarm activated by the driver'}
		*/
		this_device.emit("alarm",	alarm_data.code, alarm_data, msg_parts);
	}
	
	
	/****************************************
	SET REFRESH TIME
	****************************************/
	this.set_refresh_time = function(interval, duration){
		this_device.adapter.set_refresh_time(interval, duration);	
	}
	
	/* adding methods to the adapter */
	this.adapter.get_device = function(){
		return device;	
	}
	this.send = function(msg){
		this.emit("send_data",msg);
		this.connection.write(msg);
		console.log("Sending to "+this_device.uid+": "+msg);
	}
	this.send_byte_array = function(array){
		this.emit("send_byte_data",array);
		var buff = new Buffer(array);
		console.log(buff);
		console.log("Sending to "+this_device.uid+": <Array: ["+array+"]>");
	}
}

function do_log(msg){
	console.log(" > "+msg);	
}
exports.start_server = start_server;
exports.version = require('../package').version;