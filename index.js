const MatrixClient = require("matrix-bot-sdk").MatrixClient;
const AutojoinRoomsMixin = require("matrix-bot-sdk").AutojoinRoomsMixin;

const Eliza = require('eliza-as-promised');
 
const client = new MatrixClient("https://matrix.org", "MDAxOGxvY2F0aW9uIG1hdHJpeC5vcmcKMDAxM2lkZW50aWZpZXIga2V5CjAwMTBjaWQgZ2VuID0gMQowMDI3Y2lkIHVzZXJfaWQgPSBAZWxpemFib3Q6bWF0cml4Lm9yZwowMDE2Y2lkIHR5cGUgPSBhY2Nlc3MKMDAyMWNpZCBub25jZSA9IHRid0lrRWpPPW1MQzcqX2MKMDAyZnNpZ25hdHVyZSA6nZoqRham5etdVNyyAGRWvU_eTnMxTJXaJMUNyJW3XAo");
AutojoinRoomsMixin.setupOnClient(client);

var elizas = {};

async function startEliza(roomId) {
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

client.on("room.join", (roomId, event) => {
    if (process.uptime() < 10) {
        return;
    }
    console.log("++++++++++\room.join++++++++++\n++++++++++");
    console.log(roomId);
    startEliza(roomId);
});
 
client.on("room.message", (roomId, event) => {
    // early exit reasons
    if (! event.content) return;
    if (event.sender === "@elizabot:matrix.org") return;
    if (event.sender === "@server:matrix.org") return;
    if (event.unsigned.age > 1000 * 60) return; // older than a minute

    console.log(event.sender + " says " + event.content.body);
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