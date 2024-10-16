#!/bin/bash

npm run format:check -- src/should-parse.ts

EXIT_CODE=$?

if [ $EXIT_CODE -eq 2 ]; then
  echo "Format check crashed"
  exit 1
fi

if [ $EXIT_CODE -eq 0 ]; then
  echo "Format check unchanged, did you accidentally commit a formatted file?"
  exit 1
fi

if [ $EXIT_CODE -eq 1 ]; then
  echo "No parse errors found in the file, but formatting is incorrect. Success!"
  exit 0
fi

echo "Unknown exit code: " $EXIT_CODE

exit 1
