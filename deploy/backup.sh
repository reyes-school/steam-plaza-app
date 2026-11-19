#!/bin/sh
# Daily backup: database + uploaded files. Keep 30 days. Copy /var/backups/steamplaza to another server or disk too.
set -e
D=/var/backups/steamplaza; mkdir -p "$D"; T=$(date +%F)
pg_dump steamplaza | gzip > "$D/db-$T.sql.gz"
tar -czf "$D/files-$T.tar.gz" -C /var/lib/steamplaza uploads
find "$D" -name '*-*.gz' -mtime +30 -delete
