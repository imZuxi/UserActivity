require("dotenv").config();

module.exports = {
  OP: {
    // only store the important opcodes only.
    // https://discord.com/developers/docs/topics/opcodes-and-status-codes
    dispatch: 0,
    heartbeat: 1,
    identify: 2,
    presenceUpdate: 3,
    resume: 6,
    reconnect: 7,
    invalidSession: 9,
    HELLO: 10,
    heartbeatACK: 11
  },

  Constants: {
    // i still have no idea.
    // dont change this unless you know what you're doing.
    seq: 13373333,

    // default, discord will figure it out.
    heartbeatTimeout: 1000 * 30,

    // https://www.remote.tools/remote-work/how-to-find-discord-id
    userMonitoredID: "459742547305299981",

    // for resuming. so your app wont ded immediately, so you have to send the request again. (afaik)
    sessionID: null,

    // setinterval func
    heartbeatInterval: null
  },
};

module.exports.Identification = {
  token: process.env.SECRET, // your bot token.
  v: 9, // https://discord.com/developers/docs/topics/gateway#gateways-gateway-versions
  intents: 1 << 1 | 1 << 8, // https://discord.com/developers/docs/topics/gateway#list-of-intents
  properties: {
    "$os": process.platform,
    "$browser": "ZUXI_EXPOSED_SECRETS",
    "$device": "13373333"
  }
}