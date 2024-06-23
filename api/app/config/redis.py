from redis import Redis

client = Redis(host="redis-service", decode_responses=True)
