/*
 * Copyright (c) 2017-2020 [Ribose Inc](https://www.ribose.com).
 * Copyright (c) 2009-2010 The NetBSD Foundation, Inc.
 * All rights reserved.
 *
 * This code is originally derived from software contributed to
 * The NetBSD Foundation by Alistair Crooks (agc@netbsd.org), and
 * carried further by Ribose Inc (https://www.ribose.com).
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * ``AS IS'' AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED
 * TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 * PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDERS OR CONTRIBUTORS
 * BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */
#ifndef RNPSDK_H_
#define RNPSDK_H_

#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>

#if defined(__cplusplus)
extern "C" {
#endif

#include <rnp/rnp_def.h>

typedef enum { RNP_HEX_LOWERCASE, RNP_HEX_UPPERCASE } rnp_hex_format_t;

int rnp_strcasecmp(const char *, const char *);

char *rnp_strhexdump_upper(char *dest, const uint8_t *src, size_t length, const char *sep);

char *rnp_compose_path(const char *first, ...);
char *rnp_compose_path_ex(char **buf, size_t *buf_len, const char *first, ...);

bool rnp_path_exists(const char *path);
bool rnp_dir_exists(const char *path);
bool rnp_file_exists(const char *path);
int  rnp_unlink(const char *path);

bool rnp_hex_encode(
  const uint8_t *buf, size_t buf_len, char *hex, size_t hex_len, rnp_hex_format_t format);
size_t rnp_hex_decode(const char *hex, uint8_t *buf, size_t buf_len);

char *rnp_strlwr(char *s);

bool hex2bin(const char *hex, size_t hexlen, uint8_t *bin, size_t len, size_t *out);

void pgp_forget(void *, size_t);

#if defined(__cplusplus)
}
#endif

#endif
