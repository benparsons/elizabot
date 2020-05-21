process.chdir(__dirname);

const MatrixClient = require("matrix-bot-sdk").MatrixClient;
const AutojoinRoomsMixin = require("matrix-bot-sdk").AutojoinRoomsMixin;
var os = require('os');

var config = require('config');
var access_token = "";
var homeserver = "";
var bot_user = "";
if (!( config.has('access_token') && config.has('homeserver') && config.has('bot_user'))) {
    console.log("config fields required: access_token, homeserver, bot_user");
    process.exit(1);
}

access_token = config.get('access_token');
homeserver = config.get('homeserver');
bot_user = config.get('bot_user');

loggingRoom = config.has('logging_room') ? config.get('logging_room') : undefined;

const Eliza = require('eliza-as-promised');
 
const client = new MatrixClient(homeserver, access_token);
AutojoinRoomsMixin.setupOnClient(client);
client.start().then(() => console.log("Client started!"));

var elizas = {};

sendLog(`Started on ${os.hostname}`);

function sendLog(message) {
    if (loggingRoom) {
        client.sendMessage(loggingRoom, {
            "msgtype": "m.notice",
            "body": message
        });
    }
    else {
        console.log(message);
    }
}

async function startEliza(roomId) {
    sendLog(`startEliza for ${roomId}`);
    delete elizas[roomId];
    
    var power = await client.userHasPowerLevelFor(bot_user, roomId, "m.room.message")

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
    if (event.sender === bot_user) return;
    if (event.sender === bot_user) return;
    if (event.sender === "@server:matrix.org") return;
    if (event.unsigned.age > 1000 * 60) return; // older than a minute
    if (roomId === loggingRoom) return;
    // var sender = await client.getUserId();
    // if (event["sender"] === sender) return;

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
 