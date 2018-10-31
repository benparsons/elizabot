const MatrixClient = require("matrix-bot-sdk").MatrixClient;
const AutojoinRoomsMixin = require("matrix-bot-sdk").AutojoinRoomsMixin;
var os = require('os');
var config = require('config');
var access_token = "";
if (config.has('access_token')) {
    access_token = config.get('access_token');
} else {
    console.log("mising access_token");
    process.exit(1);
}
  


const Eliza = require('eliza-as-promised');
 
const client = new MatrixClient("https://matrix.org", access_token);
AutojoinRoomsMixin.setupOnClient(client);

var elizas = {};

var loggingRoom = "!uJHcyrdVMXEzEYzZcI:matrix.org";

sendLog(`Started on ${os.hostname}`);

function sendLog(message) {
    client.sendMessage(loggingRoom, {
        "msgtype": "m.notice",
        "body": message
    });
}

async function startEliza(roomId) {
    sendLog(`startEliza for ${roomId}`);
    delete elizas[roomId];
    
    var power = await client.userHasPowerLevelFor("@elizabot:matrix.org", roomId, "m.room.message")

    elizas[roomId] = {
        eliza: new Eliza(),
        last: (new Date()).getTime()
    }
    client.sendMessage(roomId, {
        "msgtype": "m.notice",
        "body": elizas[roomId].eliza.getInitial()
    });
}

client.on("room.join", (roomId) => {
    sendLog(`Got join event for ${roomId}`);
    if (process.uptime() < 10) {
        return;
    }
    startEliza(roomId);
});
 
client.on("room.message", (roomId, event) => {
    // early exit reasons
    if (! event.content) return;
    if (event.sender === "@elizabot:matrix.org") return;
    if (event.sender === "@server:matrix.org") return;
    if (event.unsigned.age > 1000 * 60) return; // older than a minute
    if (roomId === loggingRoom) return;

    //console.log(event.sender + " says " + event.content.body);
    if (!elizas[roomId] || (new Date()).getTime() - elizas[roomId].last > 1000 * 60 * 5) {
        startEliza(roomId);
    }
    elizas[roomId].last = (new Date()).getTime();

    elizas[roomId].eliza.getResponse(event.content.body)
        .then((response) => {
            var responseText = '';
            if (response.reply) { responseText = response.reply; }
            if (response.final) { responseText = response.final; }

            client.sendMessage(roomId, {
                "msgtype": "m.notice",
                "body": responseText,
                "responds": {
                    "sender": event.sender,
                    "message": event.content.body
                }
            }).then((eventId) => {
                if (response.final) {
                    client.leaveRoom(roomId);
                }
            });
    });
});
 
client.start().then(() => console.log("Client started!"));