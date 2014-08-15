# #GPS_TRACKING
This module let you easily create listeners for your GPS tracking devices. You can add your custom implementations to handle more protocols. 

### Stay tuned - Contributions
We are adding support for multiple devices and protocols.
We highly appreciate your contributions to the project. 
Please, just throw me an email at gonzalo@freshworkstudio.com if you have questions/suggestions.


### Why NodeJS?
nodeJS appears to be the perfect solution to receive the data for your multiple GPS devices thanks to the amazing performance an ease of use. 

####Currently supported models
- TK103

###Installation   
With package manager [npm](http://npmjs.org/):

	npm install gps-tracking

### Prerequisites
#### MongoDB
You need to have a mongo database up and running. 
[How to install MongoDB](http://docs.mongodb.org/manual/installation/)

#Usage
Once you have installed gps-tracking module and a mongo database: 

``` javascript
var gps = require("gps-tracking");

var options = {
	'debug'					: true,
	'port'					: 8090,
	'device_adapter'		: "TK103",
	"mongodb_connection"	: false, 
	"mongodb_server": 
	{
		"host":"127.0.0.1",
		"port":27017,
		"opts":{}
	},
	'mongo_database':
	{
		'name':'gps-tracking-database',
		'auth':false, 
		'user':'your-username', //if auth=true
		'password':'your-password' //if auth=true
	},
	"mongo_tables"				: 
	{
		"gps_data"  : "gps_data_table",
		"alarms"    : "alarms_table"
	}
}

var server = gps.server(opts,function(device,connection){
    
    //When the device sends the login request packet
    device.on("login_request",function(device_id,msg_parts){
    
		//Do some stuff before authenticate the device... 
		//Accept the login request. You can set false to reject the device.
		this.login_authorized(true); 
	});
	
	
	//PING - When the gps sends their position  
	device.on("ping",function(data){
		//After the ping is received, but before the data is saved
		//console.log(data);
		return data;
	});
}
```

### Options
``` javascript
    "debug":false, //Enables console.log messages. 
```

``` javascript
    "port": 8080, //The port to listen to. Where the packages of the device will arrive. 
```

``` javascript
    "device_adapter": false, 
    // Wich device adapter will be used to parse the incoming packets. 
    // If false, the server will throw an error. 
    // At the moment, the modules comes with only one adater: TK103.
    "device_adapter": "TK103"
    // You can create your own adapter. 
    
    //FOR USING A CUSTOM DEVICE ADAPTER
     "device_adapter": require("./my_custom_adapter")
```

``` javascript
    "mongo_server": {
        "host":"127.0.0.1", //Host where mongo is running
        "port":27017, //Port where is running
        "opts":{} //More options to pass to the connection
    }, 
    /* it uses: 
    * var server = new mongodb.Server() function. 
    */
```

``` javascript
    "mongo_database": {
        'name':'db_name', 
        'auth':false, 
        'user':'your-username', //if auth=true
        'password':'your-password' //if auth=true
    }, 
    /* 
    * name: Name of the database where the data it will be saved
    * auth: If the connection to the database requires user/password
    * user: user for authentication
    * password: password for authentication
    */
```

``` javascript
   "mongo_tables"				: 
	{
		"gps_data"  : "gps_data_table", //default: 'gps_data'
		"alarms"    : "alarms_table" //defaut: 'alarms'
	}
    /* 
    * gps_data: Name of the table where the gps positions will be saved
    * alarms: Name of the table where the alarms received will be saved.
    */
```
# Events
Once you create a server, you can access to the connection and the device object connected. Both emits events you can listen to create your app. 
```javascript
var server = gps.server(opts,function(device,connection){
    //conection = net.createServer(...) object
    //device = Device object
}
```
#### connection events
Emits: 'end','data','close','timeout','drain'
You can [check the documentation here](http://nodejs.org/api/net.html#net_net_createserver_options_connectionlistener).

``` javascript
//Example: 
var server = gps.server(opts,function(device,connection){
    connection.on("data",function(res){
		//When raw data comes from the device
	});
});
```

### Device object events
Every time something connects to the server, a net connection and a new device object will be created.
The Device object is your interface to send & receive packets/commands. 
``` javascript
var server = gps.server(opts,function(device,connection){
    /*	Available device variables:
		----------------------------
		device.uid -> is setted when the first packet is parsed
		device.name -> you can set a custon name for this device.
		device.ip -> ip of the device
		device.port --> device port
	*/
	
    /******************************
	LOGIN
	******************************/
	
	device.on("login_request",function(device_id,msg_parts){
		//Do some stuff before authenticate the device... 
		this.login_authorized(true); //Accept the login request.
	});
	device.on("login",function(){
		//this = device
		console.log("Hi! i'm "+this.uid);
	});
	device.on("login_rejected",function(){
		//this = device
		console.log("Hi! i'm "+this.uid);
	});
	
	
	/******************************
	PING - When the gps sends their position  
	******************************/
	device.on("ping",function(data){
		//After the ping is received, but before the data is saved
		//console.log(data);
		return data;
	});
	
	device.on("save_ping",function(ping_id, data){
		//After the ping is received and saved
		
	});
	
	/******************************
	ALARM - When the gps sends and alarm  
	******************************/
	device.on("alarm",function(alarm_code,alarm_data,msg_data){
		console.log("Help! Something happend: "+alarm_code+" ("+alarm_data.msg+")");
		call_me();
	});	
	
	
	/******************************
	MISC 
	******************************/
	device.on("handshake",function(){
		//this = device
		console.log("Hi! i'm "+this.uid);
	});
	
});
```


## Custom adapters
You have to create and exports an adapter function. 
```javascript
exports.protocol="GPS103";
exports.model_name="TK103";
exports.compatible_hardware=["TK103/supplier"];

var adapter = function(device){
    //Code that parses and respond to commands
}
exports.adapter = adapter;
```
#### Functions you have to implement
##### function parse_data(data)
You receive the data and you have to return an object with: 

```javascript
return {
    'device_id': 'string',
    // ID of the device. Mandatory
    
    'cmd': 'string',
    //'string' Represents what the device is trying to do. You can send some of the available commands or a custom string. Mandatory
    
    'data': 'string'
    //Aditional data in the packet. Mandatory
}
```
#### Available commands (What the device is trying to do?)
``` javscript
'cmd':'login_request' // The device is trying to login.
'cmd':'alarm'   //  (login_request, ping, alarm) 
'cmd':'ping'  //The device is sending gps_data

//Or send custom string
'cmd':'other_command' //You can catch this custom command in you app.
```
Example: 
```javascript
    var adapter = function(device){
        function parse_data(data){
            // Example implementation
            //
            // Packet from device: 
            // #ID_DEVICE_XXX#TIME#LOG_ME_IN_PLEASE#MORE_DATA(GPS,LBS,ETC)#
            
            //Do some stuff...
            return {
    			"device_id" : 'ID_DEVICE_XXX',//mandatory
    			"cmd" 		: 'login_request', //mandatory
    			"data" 		: 'MORE_DATA(GPS,LBS,ETC)' //Mandatory
    			
    			//optional parameters. Anything you want.
    			"optional_params': '',
    			"more_optional_parameters':'...',
            }
        }
    }
```


### Full example (device_adapter implementation)
This is the implementation for TK103. 
Example data:

#### Login request from TK103
Packet: 
(012341234123BP05000012341234123140607A3330.4288S07036.8518W019.2230104172.3900000000L00019C2C)

So, 
Start String = "("
Device ID = "012341234123"
Command = "BP05" --> "login_request"
Custom Data = "000012341234123140607A3330.4288S07036.8518W019.2230104172.3900000000L00019C2C"
Finish String = ")"

```javascript
/* */

/* */
// some functions you could use like this 
// f = require('gps-tracking/functions'). There are optionals
f = require("../functions");

exports.protocol="GPS103";
exports.model_name="TK103";
exports.compatible_hardware=["TK103/supplier"];

var adapter = function(device){
	if(!(this instanceof adapter)) return new adapter(device);
	
	this.format = {"start":"(","end":")","separator":""}
	this.device = device;
	
	/*******************************************
	PARSE THE INCOMING STRING FROM THE DECIVE 
	You must return an object with a least: device_id, cmd and type.
	return device_id: The device_id
	return cmd: command from the device.
	return type: login_request, ping, etc. 
	*******************************************/
	this.parse_data = function(data){
		data = data.toString();
		var cmd_start = data.indexOf("B"); //al the incomming messages has a cmd starting with 'B'
		if(cmd_start > 13)throw "Device ID is longer than 12 chars!";
		var parts={
			"start" 		: data.substr(0,1), 
			"device_id" 	: data.substring(1,cmd_start),//mandatory
			"cmd" 			: data.substr(cmd_start,4), //mandatory
			"data" 			: data.substring(cmd_start+4,data.length-1),
			"finish" 		: data.substr(data.length-1,1)
		};
		switch(parts.cmd){
			case "BP05":
				parts.action="login_request";	
				break;
			case "BR00":
				parts.action="ping";
				break;
			case "BO01":
				parts.action="alarm";
				break;
			default:
				parts.action="other";
		}
		
		return parts;
	}
	this.authorize =function(){
		this.send_comand("AP05");
	}
	this.run_other = function(cmd,msg_parts){
		switch(cmd){
			case "BP00": //Handshake
				this.device.send(this.format_data(this.device.uid+"AP01HSO"));
				break;
		}
	}
	
	this.request_login_to_device = function(){
		//@TODO: Implement this.	
	}
	
	this.receive_alarm = function(msg_parts){
		//@TODO: implement this
		
		//Maybe we can save the gps data too.
		//gps_data = msg_parts.data.substr(1);
		alarm_code = msg_parts.data.substr(0,1);
		alarm = false;
		switch(alarm_code.toString()){
			case "0":
				alarm = {"code":"power_off","msg":"Vehicle Power Off"};
				break;
			case "1":
				alarm = {"code":"accident","msg":"The vehicle suffers an acciden"};
				break;
			case "2":
				alarm = {"code":"sos","msg":"Driver sends a S.O.S."};
				break;
			case "3":
				alarm = {"code":"alarming","msg":"The alarm of the vehicle is activated"};
				break;
			case "4":
				alarm = {"code":"low_speed","msg":"Vehicle is below the min speed setted"};
				break;
			case "5":
				alarm = {"code":"overspeed","msg":"Vehicle is over the max speed setted"};
				break;
			case "6":
				alarm = {"code":"gep_fence","msg":"Out of geo fence"};
				break;
		}
		this.send_comand("AS01",alarm_code.toString());
		return alarm
	}
	
	
	this.get_ping_data = function(msg_parts){
		var str = msg_parts.data;
		var data = {
			"date"			: str.substr(0,6),
			"availability"	: str.substr(6,1),
			"latitude"		: functions.minute_to_decimal(parseFloat(str.substr(7,9)),str.substr(16,1)),
			"longitude"	: functions.minute_to_decimal(parseFloat(str.substr(17,9)),str.substr(27,1)),
			"speed"			: parseFloat(str.substr(28,5)),
			"time"			: str.substr(33,6),
			"orientation"	: str.substr(39,6),
			"io_state"		: str.substr(45,8),
			"mile_post"	: str.substr(53,1),
			"mile_data"	: parseInt(str.substr(54,8),16)
		};
		var datetime = "20"+data.date.substr(0,2)+"/"+data.date.substr(2,2)+"/"+data.date.substr(4,2);
		datetime += " "+data.time.substr(0,2)+":"+data.time.substr(2,2)+":"+data.time.substr(4,2)
		data.datetime=new Date(datetime);
		res = {
			latitude		: data.latitude,
			longitude		: data.longitude,
			time			: new Date(data.date+" "+data.time),
			speed			: data.speed,
			orientation	: data.orientation,
			mileage			: data.mile_data
		}
		return res;	
	}
	
	/* SET REFRESH TIME */
	this.set_refresh_time = function(interval,duration){
		//XXXXYYZZ
		//XXXX Hex interval for each message in seconds
		//YYZZ Total time for feedback
		//YY Hex hours
		//ZZ Hex minutes
		var hours = parseInt(duration/3600);
		var minutes = parseInt((duration-hours*3600)/60);
		var time = f.str_pad(interval.toString(16),4,'0')+ f.str_pad(hours.toString(16),2,'0')+ f.str_pad(minutes.toString(16),2,'0')
		this.send_comand("AR00",time);
	}
	
	/* INTERNAL FUNCTIONS */
	
	this.send_comand = function(cmd,data){
		var msg = [this.device.uid,cmd,data];
		this.device.send(this.format_data(msg));
	}
	this.format_data = function(params){
		/* FORMAT THE DATA TO BE SENT */
		var str = this.format.start;
		if(typeof(params) == "string"){
			str+=params
		}else if(params instanceof Array){
			str += params.join(this.format.separator);
		}else{
			throw "The parameters to send to the device has to be a string or an array";
		}
		str+= this.format.end;
		return str;	
	}
}
exports.adapter = adapter;


```
