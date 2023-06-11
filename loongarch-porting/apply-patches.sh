#!/bin/bash

for i in $(cat ./debian/patches/series);
do
  patch -p1 -N --verbose < ./debian/patches/$i
done

exit 0
