const Eliza = require('eliza-as-promised');
const MatrixClient = require("matrix-bot-sdk").MatrixClient;
const AutojoinRoomsMixin = require("matrix-bot-sdk").AutojoinRoomsMixin;

var config = require('config');
var access_token = "";
var homserver = "";
if (config.has('access_token')) {
    access_token = config.get('access_token');
} else {
    console.log("mising access_token");
    process.exit(1);
}
if (config.has('homeserver')) {
    homeserver = config.get('homeserver');
} else {
    console.log("mising homeserver");
    process.exit(1);
}

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