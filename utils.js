const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const querystring = require('querystring');
const fs = require('fs/promises')
const fsa = require('fs')
const path = require('path')
const redis = require('redis');

// Spotify API credentials
const clientId = process.env.SpotifyClientID;
const clientSecret = process.env.SpotifyclientSecret
let songlengh = 0;
let lasttrackid = ""
let offlinefor = Date.now()
let laststatus = "idle";

const client = redis.createClient({
    url: process.env.REDIS_CONNECTION_STRING,
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

    //console.log(require("util").inspect(rawdata, false, null, false));
    fsa.writeFileSync(path.join(__dirname, 'sniffeddata.json'), require("util").inspect(rawdata, false, null, false));
    let data = JSON.parse(rawdata);

    let status = "idle";
    if (data.status === "offline") {
        status = "offline";
    }

    let userobject = {
        status: data.status,
        song_data: {
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

    const ListeningActivity = data.activities.find(activity => activity.type === 2);
    if (ListeningActivity) {
        let ListeningObject = {
            song_name: ListeningActivity.details,
            song_artist: ListeningActivity.state,
            song_image: "",
            song_start: ListeningActivity.timestamps.start,
            song_end: ListeningActivity.timestamps.end,
            song_length: ListeningActivity.timestamps.end - ListeningActivity.timestamps.start
        };
    
        // Corrected startsWith and substring with type check
        if (typeof ListeningObject.song_artist === "string" && ListeningObject.song_artist.startsWith("by ")) {
            ListeningObject.song_artist = ListeningObject.song_artist.substring(3);
        }
    
        // Await for the image sniffer function
        await discordimagesniffer(ListeningActivity.application_id, ListeningActivity.assets.large_image)
            .then(datab => ListeningObject.song_image = datab);
    
        userobject.song_data = ListeningObject;
    }

    const topGameActivity = data.activities.find(activity => activity.type === 0 && activity.name !== "Apple Music");
    if (topGameActivity) {
        let game = {
            game_name: topGameActivity.name,
            game_image: null,
            game_details: topGameActivity.details || null,
            playing_since: Date.now()
        }

        try {
            discordimagesniffer(topGameActivity.application_id, topGameActivity.assets.large_image).then(datab => game.game_image = datab)
        } catch (eximgsniffer) {
            console.error(eximgsniffer)
        }

        if (!game.game_image) {
            await discordimagesniffer(topGameActivity.application_id, null).then(datab => game.game_image = datab)
        }

        try {
            game.playing_since = topGameActivity.timestamps.start

        } catch { };
        userobject.game = game
    }
    console.log(JSON.stringify(userobject));
    client.set("zuxistatus", JSON.stringify(userobject), (err, reply) => {
        if (err) {
            console.error(`Error setting Redis key: ${err}`);
        } else {
            console.log(`Redis key set successfully. Reply: ${reply}`);
        }
    });


    //  fs.writeFileSync(path.join(__dirname, '../src/utils/zuxijsondata'), JSON.stringify(userobject));
}

async function discordimagesniffer(applicationid, image_uri) {
    if (isDiscordSnowflake(image_uri)) {
        return `https://cdn.discordapp.com/app-assets/${applicationid}/${image_uri}`;
    }
    if (image_uri && image_uri.startsWith("spotify")) {
        return 'https://i.scdn.co/image/' + image_uri.split(':')[1]
    }

    if (image_uri && image_uri.startsWith("mp:external/") && image_uri.includes("https")) {
        // Extract the part after "https://"
        const startIndex = image_uri.indexOf("https/");
        if (startIndex !== -1) {
            return "https://" + image_uri.substring(startIndex + 6); // 6 accounts for "https/"
        }
    }

    if (!image_uri) {
        let img;
        await cache(applicationid).then(datab => img = `https://cdn.discordapp.com/app-icons/${applicationid}/${datab}`)
        return img
    }

    return image_uri;
}



function isDiscordSnowflake(input) {
    const snowflakeRegex = /^[0-9]{18,19}$/;
    return snowflakeRegex.test(input);
}

// Example usage
module.exports = {
    extractTopActivity
}

// Function to obtain access token and get track information


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
let lookupid = [];
//,


const cacheFilePath = path.join(__dirname, 'gamecache.json');
