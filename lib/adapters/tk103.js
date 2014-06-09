/* */
var adapter = function(device){
	if(!(this instanceof adapter)) return new adapter(device);
	this.model_name = "TK103";
	this.protocol="GPS103";
	
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
		this.device.send(this.format_data(this.device.uid+"AP05")); 
	}
	this.run_other = function(cmd,msg_parts){
		switch(cmd){
			case "BP00": //Handshake
				this.device.send(this.format_data(this.device.uid+"AP01HSO"));
				break;
			case "BO01": //Alarm!
				gps_data = msg_parts.data.substr(1);
				alarm_type = msg_parts.data.substr(0,1);
				this.device.send(this.format_data(this.device.uid+"AS01"+alarm_type));
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
		return alarm
	}
	
	
	/* INTERNAL FUNCTIONS */
	this.get_ping_data = function(msg_parts){
		var str = msg_parts.data;
		var data = {
			"date"			: str.substr(0,6),
			"availability"	: str.substr(6,1),
			"latitude"		: this.gps_minute_to_decimal(parseFloat(str.substr(7,9)),str.substr(16,1)),
			"longitude"	: this.gps_minute_to_decimal(parseFloat(str.substr(17,9)),str.substr(27,1)),
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
	this.gps_minute_to_decimal = function(pos,pos_i){
		if(typeof(pos_i)=="undefined")pos_i = "N";
		var dg = parseInt(pos/100);
		var minutes = pos-(dg*100);
		var res = (minutes/60)+dg;
		return (pos_i.toUpperCase()=="S" || pos_i.toUpperCase()=="W")?res*-1:res;	
	}
	
	this.format_data = function(params){
		var str = this.format.start;
		if(typeof(params) == "string"){
			str+=params
		}else if(typeof(params) =="array"){
			str += params.join(this.format.separator);
		}else{
			throw "The parameters to send to the device has to be a string or an array";
		}
		str+= this.format.end;
		return str;	
	}
}
exports.adapter = adapter;

