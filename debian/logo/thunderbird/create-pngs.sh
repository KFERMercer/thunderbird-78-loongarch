#!/bin/bash

src=thunderbird.svg

for d in 16 22 24 32 48 64 128 256 512;
do
	# using ImageMagick
	#convert -background none $src -resize ${d}x${d} mailicon${d}.png

	# using Inkscape
	inkscape --export-png=mailicon${d}.png --export-width=$d --export-height=$d --export-background-opacity=0 --without-gui $src
done

