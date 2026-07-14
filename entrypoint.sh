#!/bin/sh
set -a
. /app/.env.production
set +a
exec node server.js
