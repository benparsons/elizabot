const Eliza = require('eliza-as-promised');
const MatrixClient = require("matrix-bot-sdk").MatrixClient;
const AutojoinRoomsMixin = require("matrix-bot-sdk").AutojoinRoomsMixin;

var config = require('config');
var access_token = "";
var homeserver = "";
var bot_user = "";
if (!( config.has('access_token') && config.has('homeserver') && config.has('bot_user'))) {
} else {
    console.log("config fields required: access_token, homeserver, bot_user");
    process.exit(1);
}

access_token = config.get('access_token');
homeserver = config.get('homeserver');
bot_user = config.get('bot_user');

const client = new MatrixClient(homeserver, access_token);
AutojoinRoomsMixin.setupOnClient(client);
client.start().then(() => console.log("Client started!"));

var elizas = {};
client.on("room.join", (roomId) => {
    elizas[roomId] = {
        eliza: new Eliza(),
        last: (new Date()).getTime()
    }
    client.sendMessage(roomId, {
        "msgtype": "m.notice",
        "body": elizas[roomId].eliza.getInitial()
    });
});
client.on("room.message", (roomId, event) => {
    if (event.sender === bot_user) return;
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