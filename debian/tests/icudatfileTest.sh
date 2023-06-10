#!/bin/sh

set -e

TESTFILE=$(basename $0 .sh)
ICUDATFILE=$(basename /usr/lib/thunderbird/icud*.dat)

if [ -f "/usr/lib/thunderbird/${ICUDATFILE}" ]; then
    echo "Running tests in ${TESTFILE}"

    echo -n "Test1: Check if /usr/lib/thunderbird/${ICUDATFILE} is linked to /usr/share/thunderbird/${ICUDATFILE}..."
    if [ "$(readlink -e "/usr/share/thunderbird/${ICUDATFILE}")" = "/usr/lib/thunderbird/${ICUDATFILE}" ]; then
        echo "done"
    else
        echo "No!"
        exit 1
    fi
else
    echo "Nothing to be done here."
fi

echo "All Tests in ${TESTFILE} finished succesfully."
