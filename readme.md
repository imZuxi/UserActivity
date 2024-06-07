# Website Backend

This is the backend for my website, developed before I discovered Lanyard. It powers status updates and stores data in Redis for low-latency caching and retrieval. The website never interacts directly with the backend but communicates through the Redis API.

I've decided to make this open source since there is no point in keeping it closed source. It includes additional features like automatic processing of Discord-related content, such as converting discord url images to return their raw URLs.