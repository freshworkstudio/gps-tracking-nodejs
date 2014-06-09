
exports.send = function(socket,msg){
	socket.write(msg);
	console.log("Sending to "+socket.name+": "+msg);
}

exports.parse_data = function(data){
	data = data.replace(/(\r\n|\n|\r)/gm,""); //Remove 3 type of break lines
	var cmd_start = data.indexOf("B"); //al the incomming messages has a cmd starting with 'B'
	if(cmd_start > 13)throw "Device ID is longer than 12 chars!";
	var parts={
		"start" 		: data.substr(0,1),
		"device_id" 	: data.substring(1,cmd_start),
		"cmd" 			: data.substr(cmd_start,4),
		"data" 			: data.substring(cmd_start+4,data.length-1),
		"finish" 		: data.substr(data.length-1,1)
	};
	return parts;
}
exports.parse_gps_data = function(str){
	var data = {
		"date"			: str.substr(0,6),
		"availability"	: str.substr(6,1),
		"latitude"		: gps_minute_to_decimal(parseFloat(str.substr(7,9))),
		"latitude_i"	: str.substr(16,1),
		"longitude"	: gps_minute_to_decimal(parseFloat(str.substr(17,9))),
		"longitude_i"	: str.substr(27,1),
		"speed"			: str.substr(28,5),
		"time"			: str.substr(33,6),
		"orientation"	: str.substr(39,6),
		"io_state"		: str.substr(45,8),
		"mile_post"	: str.substr(53,1),
		"mile_data"	: parseInt(str.substr(54,8),16)
	};
	return data;	
}

exports.send_to = function(socket,cmd,data){
	if(typeof(socket.device_id) == "undefined")throw "The socket is not paired with a device_id yet";
	var str = gps_format.start;
	str += socket.device_id+gps_format.separator+cmd;
	if(typeof(data) != "undefined")str += gps_format.separator+data;
	str += gps_format.end;
	send(socket,str);
	//Example: (<DEVICE_ID>|<CMD>|<DATA>) - separator: | ,start: (, end: )
}

exports.minute_to_decimal = function(pos,pos_i){
	if(typeof(pos_i))pos_i = "N";
	var dg = parseInt(pos/100);
	var minutes = pos-(dg*100);
	var res = (minutes/60)+dg;
	return (pos_i.toUpperCase()=="S" || pos_i.toUpperCase()=="W")?res*-1:res;	
}

// Send a message to all clients
exports.broadcast = function(message, sender) {
	clients.forEach(function (client) {
	  if (client === sender) return;
	  client.write(message);
	});
	process.stdout.write(message+"\n");
}