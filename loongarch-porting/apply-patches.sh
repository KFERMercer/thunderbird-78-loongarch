#!/bin/bash

for i in $(cat ./debian/patches/series); do

    patch -p1 -N --verbose --reject-file=/dev/null < ./debian/patches/$i

    # PATCH_STAT=$?

    if [[ $? != '0' ]]; then

    echo "检测到合并冲突, break!!"

    break

    return 1

    fi

done

# if [[ $PATCH_STAT != '0' ]]; then

#     # for i in $(tac ./debian/patches/series); do

#     #     patch -Rp1 -N --verbose --reject-file=/dev/null < ./debian/patches/$i
#     #     patch -Rp1 -N --verbose --reject-file=/dev/null < ./debian/patches/$i
#     #     patch -Rp1 -N --verbose --reject-file=/dev/null < ./debian/patches/$i

#     # done

#     return 1

# fi
