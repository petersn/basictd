#!/usr/bin/bash
set -x
set -e

npm run build
scp -r public/* root@45.33.42.246:/var/www/peter.website/td/
