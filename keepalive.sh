#!/bin/bash
while true; do
  cd /home/z/my-project
  npx next dev -p 3000 2>&1 | tee /home/z/my-project/dev.log
  echo "Server died, restarting in 2s..."
  sleep 2
done
