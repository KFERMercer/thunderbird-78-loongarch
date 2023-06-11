#!/bin/bash

git diff HEAD ':!debian' > $1

exit 0
