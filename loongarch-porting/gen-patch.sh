#!/bin/bash

if [ $1 ]; then

    git diff HEAD ':!debian' ':!loongarch-porting' > $1

else

    git diff HEAD ':!debian' ':!loongarch-porting'

fi

exit 0
