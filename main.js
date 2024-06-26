const WebSocket = require("ws");
const config = require("./config");
const { extractTopActivity } = require("./utils");

// supported non-browser (for Server-side) only.
let ws = new WebSocket(`wss://gateway.discord.gg/?v=${config.Identification.v}&encoding=json`);


ws.on("message", (raw) => {
  // raw Websocket data is made out of Buffer. so you have to convert it into JSON. devhuman-readable.

  if (!raw) return;

  let data;
  try {
    data = JSON.parse(Buffer.from(raw).toString("utf-8"));
  } catch (err) {
    data = null;
    return console.error(err);
  };

  // failed parsing the JSON, well just break it.
  if (!data) return;
  // console.log(data);

  let identifyRequest = JSON.stringify({op: config.OP.identify, d: config.Identification});
  let heartbeat = JSON.stringify({op: config.OP.heartbeat, d: config.Constants.seq});

  switch(data.op) {
    case config.OP.dispatch:
      if (data.t === "READY") {
        config.Constants.sessionID = data.d.session_id;
        console.log("ready.");
      };
      break;

    case config.OP.heartbeat:
      ws.send(heartbeat);
      console.log("heartbeat.");
      break;
    
    case config.OP.invalidSession:
      config.Constants.seq = 0;
      config.Constants.sessionID = null;
      ws.send(identifyRequest);
      console.warn("invalid session, identifying.");
      break;

    case config.OP.reconnect:
      if (!ws) return;

      clearInterval(config.Constants.heartbeatInterval);
      config.Constants.heartbeatInterval = null;

      if (ws.readyState !== ws.CLOSED /*&& ws.readyState !== ws.CLOSING*/) {
        try {
          if (config.Constants.sessionID) {
            if (ws.readyState === ws.OPEN) {
              console.log("reconnecting.");
              ws.close(4901, "reconnect.");
            }

            else {
              console.warn("terminated.");
              ws.terminate();
            }
          } else {
            console.log("session continued.");
            ws.close(1000, "continue.");
          };
        } catch (error) {
          console.error(error);
        };
      };

      ws = null;
      break;

    case config.OP.HELLO:
      if (data.d.heartbeat_interval > 0) {
        if (config.Constants.heartbeatInterval) clearInterval(config.Constants.heartbeatInterval);
        config.Constants.heartbeatInterval = setInterval(() => ws.send(heartbeat), data.d.heartbeat_interval);
      };

      if (config.Constants.sessionID) {
        console.log("resuming the connection.");
        ws.send(JSON.stringify({
          op: config.OP.resume,
          d: {
            token: config.Identification.token,
            session_id: config.Constants.sessionID,
            seq: config.Constants.seq
          }
        }));
      } else {
        ws.send(identifyRequest);
        ws.send(heartbeat);
      };
      break;

    // you and i dont need to know this.
    case config.OP.heartbeatACK:
      break;
    
    default:
      console.log(data);
      break;
  };

  if (
    data.t === "PRESENCE_UPDATE" &&
    data.d.user.id === config.Constants.userMonitoredID &&
    data.op === config.OP.dispatch
    ) {
      // for lurking
      //console.log(require("util").inspect(data, false, null, false));
      extractTopActivity(JSON.stringify(data.d))
     // return redis.set("activity.ray1337", result)
      //  .catch(console.error);
  };
});

ws.on("error", console.error);

ws.on("close", (code, reason) => {
  console.log(code, Buffer.from(reason).toString());
});