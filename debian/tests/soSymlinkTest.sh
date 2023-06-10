#!/bin/sh

set -e

FAIL=0

echo "Check for symlinked .so files in dev package..."

for SOFILE in `ls /usr/lib/thunderbird-devel/sdk/lib/*.so`; do
    if [ ! -L ${SOFILE} ]; then
        echo ${SOFILE} is not a symlink!
        FAIL=1
    fi
done

echo -n "Test result is "
if [ ${FAIL} -eq 0 ]; then
    echo "done."
else
    echo "FAILED!"
    exit 1
fi
