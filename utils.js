const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const querystring = require('querystring');
const fs = require('fs/promises')
const path = require('path')
const redis = require('redis');

let offlinefor = Date.now()
let laststatus = "idle";

const client = redis.createClient({
    url: process.env.REDIS_CONNECTION_URI
});
client.on('error', (err) => {
    console.error(`Error connecting to Redis server`, err);
    process.exit(1); // Exit the process on Redis connection error
});

client.on('connect', () => {
    console.log(`Connected to Redis server`);
});

client.connect()

async function extractTopActivity(rawdata) {

    if (laststatus != rawdata.status) {
        offlinefor = Date.now()
        laststatus = rawdata.status;
    }

    // Sniff incoming data for debugging

    // console.log(require("util").inspect(rawdata, false, null, false));
    // fs.writeFile(path.join(__dirname, 'sniffeddata.json'), require("util").inspect(rawdata, false, null, false));

    let data = JSON.parse(rawdata);

    // force changes status to idle since we dont want to stte when in outher modes you can change this if you want to 
    let status = "idle";
    if (data.status === "offline") {
        status = "offline";
    }

    let userobject = {
        status: data.status,
        spotify: {
            song_name: "zuxi <3",
            song_artist: "zuxi",
            song_image: null,
            song_length: 100,
            song_start: 50,
            song_end: 100
        },
        game: {
            game_name: status,
            game_image: null,
            game_details: null,
            playing_since: offlinefor
        }
    }

    // console.log(data.activities)

    // this may break against outher apps that use the listining activity
    const spotifyActivity = data.activities.find(activity => activity.type === 2);
    if (spotifyActivity) {
        let spotify = {
            song_name: spotifyActivity.details,
            song_artist: spotifyActivity.state,
            song_image: 'https://i.scdn.co/image/' + spotifyActivity.assets.large_image.split(':')[1],
            song_start: spotifyActivity.timestamps.start,
            song_end: spotifyActivity.timestamps.end,
            song_length: 0
        };
        userobject.spotify = spotify;
    }

    // use Cider Music discord RPC for Apple Music intergration
    const AppleMusicObject = data.activities.find(activity => activity.name === "Apple Music");
    if (AppleMusicObject) {
        console.log(AppleMusicObject.assets.large_image)
        let spotify = {
            song_name: AppleMusicObject.details,
            song_artist: AppleMusicObject.state.replace("by ", ""),
            song_image: "",
            song_start: AppleMusicObject.timestamps.start,
            song_end: AppleMusicObject.timestamps.end,
            song_length: AppleMusicObject.timestamps.end - AppleMusicObject.timestamps.start
        };
        await discordimagesniffer(AppleMusicObject.application_id, AppleMusicObject.assets.large_image).then(datab => spotify.song_image = datab)
        userobject.spotify = spotify;
    }


    const topGameActivity = data.activities.find(activity => activity.type === 0 && activity.name != "Apple Music");

    if (topGameActivity) {

        let game = {
            game_name: topGameActivity.name,
            game_image: null,
            game_details: topGameActivity.details || null,
            playing_since: topGameActivity.created_at
        }

        try {
            discordimagesniffer(topGameActivity.application_id, topGameActivity.assets.large_image).then(datab => game.game_image = datab)
        } catch (thisError) {
            console.error(thisError)
        }

        if (!game.game_image) {
            await discordimagesniffer(topGameActivity.application_id, null).then(datab => game.game_image = datab)
        }

        try {
        } catch { };
        userobject.game = game

    }
    console.log(JSON.stringify(userobject));
    
    // Set to redis key
    client.set("zuxistatus", JSON.stringify(userobject), (err, reply) => {
        if (err) {
            console.error(`Error setting Redis key: ${err}`);
        } else {
            console.log(`Redis key set successfully. Reply: ${reply}`);
        }

        // Close the Redis connection

    });
    // Alt Write to File
    //  fs.writeFileSync(path.join(__dirname, '../src/utils/zuxijsondata'), JSON.stringify(userobject));
}

async function discordimagesniffer(applicationid, image_uri) {
    if (isDiscordSnowflake(image_uri)) {
        return `https://cdn.discordapp.com/app-assets/${applicationid}/${image_uri}`;
    } else {
        if (image_uri && image_uri.startsWith("mp:external/") && image_uri.includes("https")) {
            // Extract the part after "https:"
            const startIndex = image_uri.indexOf("https/");

            if (startIndex !== -1) {
                return "https://" + image_uri.substring(startIndex + 6);
            }
        } else {
            if (!image_uri) {
                let img;
                await cache(applicationid).then(datab => img = `https://cdn.discordapp.com/app-icons/${applicationid}/${datab}`)
                return img
            }
        }
        return image_uri;
    }
}

function isDiscordSnowflake(input) {
    const snowflakeRegex = /^[0-9]{18,19}$/;
    return snowflakeRegex.test(input);
}

async function cache(name, value) {
    let cacheData = {};

    // Load cache from file if it exists
    try {
        if (await fs.access(cacheFilePath).then(() => true).catch(() => false)) {
            const fileData = await fs.readFile(cacheFilePath, 'utf8');
            cacheData = JSON.parse(fileData);
        }
    } catch (e) {
        console.error('Failed to load cache file:', e);
    }

    // If value is provided, update the cache
    if (value !== undefined) {
        cacheData[name] = value;
        await fs.writeFile(cacheFilePath, JSON.stringify(cacheData, null, 2));
    }

    // If the cache does not contain the requested name, fetch the data
    if (!cacheData[name] && !lookupid.includes(name)) {
        lookupid.push(name)
        try {
            const response = await fetch(`https://discord.com/api/v9/applications/public?application_ids=${name}`, {
                method: 'get',
                headers: {
                    'Authorization': process.env.USERTOKENSECRET,
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();
            cacheData[name] = data[0].icon;

            await fs.writeFile(cacheFilePath, JSON.stringify(cacheData, null, 2));
            return data.icon;
        } catch (e) {
            console.error('Failed to fetch data:', e);
            throw e;
        }
    }

    // Return the requested value
    return cacheData[name];
}
// yes discord can fire so fast we need to add it to a list 
let lookupid = [];
const cacheFilePath = path.join(__dirname, 'gamecache.json');
module.exports = {
    extractTopActivity
}

