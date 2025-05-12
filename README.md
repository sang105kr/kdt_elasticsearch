# learn-elasticsearch

# when your docker compose does not start elasticsearch, the cert may be expired.
# in that case, remove the local docker volume
```
# list docker volume
docker volume ls

# remove stale docker volume
docker volume prune

# remove docker container that attached to the volume
# docker rm -f $(docker ps -a --filter volume=<VOLUME_TO_REMOVE> -q)
docker rm -f $(docker ps -a --filter volume=learn-elasticsearch_certs -q)

# remove the volume manually
docker volume rm -f learn-elasticsearch_esdata01 learn-elasticsearch_esdata02 learn-elasticsearch_esdata03
```