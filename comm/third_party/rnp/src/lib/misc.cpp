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
/*
 * Copyright (c) 2005-2008 Nominet UK (www.nic.uk)
 * All rights reserved.
 * Contributors: Ben Laurie, Rachel Willmer. The Contributors have asserted
 * their moral rights under the UK Copyright Design and Patents Act 1988 to
 * be recorded as the authors of this copyright work.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License.
 *
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/** \file
 */
#include "config.h"

#ifdef HAVE_SYS_CDEFS_H
#include <sys/cdefs.h>
#endif

#if defined(__NetBSD__)
__COPYRIGHT("@(#) Copyright (c) 2009 The NetBSD Foundation, Inc. All rights reserved.");
__RCSID("$NetBSD: misc.c,v 1.41 2012/03/05 02:20:18 christos Exp $");
#endif

#include <sys/types.h>
#include <sys/stat.h>

#include <ctype.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <errno.h>

#ifdef HAVE_UNISTD_H
#include <sys/param.h>
#include <unistd.h>
#else
#include "uniwin.h"
#endif

#include <botan/ffi.h>
#include "crypto.h"
#include <rnp/rnp_sdk.h>
#include "utils.h"
#include "json_utils.h"

#ifdef _WIN32
#define vsnprintf _vsnprintf
#endif

/* utility function to zero out memory */
void
pgp_forget(void *vp, size_t size)
{
    botan_scrub_mem(vp, size);
}

/**
 * Searches the given map for the given type.
 * Returns a human-readable descriptive string if found,
 * returns NULL if not found
 *
 * It is the responsibility of the calling function to handle the
 * error case sensibly (i.e. don't just print out the return string.
 *
 */
static const char *
str_from_map_or_null(int type, pgp_map_t *map)
{
    pgp_map_t *row;

    for (row = map; row->string != NULL; row++) {
        if (row->type == type) {
            return row->string;
        }
    }
    return NULL;
}

/**
 * \ingroup Core_Print
 *
 * Searches the given map for the given type.
 * Returns a readable string if found, "Unknown" if not.
 */

const char *
pgp_str_from_map(int type, pgp_map_t *map)
{
    const char *str;

    str = str_from_map_or_null(type, map);
    return (str) ? str : "Unknown";
}

#define LINELEN 16

/* show hexadecimal/ascii dump */
void
hexdump(FILE *fp, const char *header, const uint8_t *src, size_t length)
{
    size_t i;
    char   line[LINELEN + 1];

    (void) fprintf(fp, "%s%s", (header) ? header : "", (header) ? "" : "");
    (void) fprintf(fp, " (%" PRIsize "u byte%s):\n", length, (length == 1) ? "" : "s");
    for (i = 0; i < length; i++) {
        if (i % LINELEN == 0) {
            (void) fprintf(fp, "%.5" PRIsize "u | ", i);
        }
        (void) fprintf(fp, "%.02x ", (uint8_t) src[i]);
        line[i % LINELEN] = (isprint(src[i])) ? src[i] : '.';
        if (i % LINELEN == LINELEN - 1) {
            line[LINELEN] = 0x0;
            (void) fprintf(fp, " | %s\n", line);
        }
    }
    if (i % LINELEN != 0) {
        for (; i % LINELEN != 0; i++) {
            (void) fprintf(fp, "   ");
            line[i % LINELEN] = ' ';
        }
        line[LINELEN] = 0x0;
        (void) fprintf(fp, " | %s\n", line);
    }
}

/* small useful functions for setting the file-level debugging levels */
/* if the debugv list contains the filename in question, we're debugging it */

enum { MAX_DEBUG_NAMES = 32 };

static int   debugc;
static char *debugv[MAX_DEBUG_NAMES];

/* set the debugging level per filename */
bool
rnp_set_debug(const char *f)
{
    const char *name;
    int         i;

    if (f == NULL) {
        f = "all";
    }
    if ((name = strrchr(f, '/')) == NULL) {
        name = f;
    } else {
        name += 1;
    }
    for (i = 0; ((i < MAX_DEBUG_NAMES) && (i < debugc)); i++) {
        if (strcmp(debugv[i], name) == 0) {
            return true;
        }
    }
    if (i == MAX_DEBUG_NAMES) {
        return false;
    }
    debugv[debugc++] = strdup(name);
    return debugv[debugc - 1] != NULL;
}

/* get the debugging level per filename */
bool
rnp_get_debug(const char *f)
{
    const char *name;
    int         i;

    if (!debugc) {
        return false;
    }

    if ((name = strrchr(f, '/')) == NULL) {
        name = f;
    } else {
        name += 1;
    }
    for (i = 0; i < debugc; i++) {
        if (strcmp(debugv[i], "all") == 0 || strcmp(debugv[i], name) == 0) {
            return true;
        }
    }
    return false;
}

void
rnp_clear_debug()
{
    for (int i = 0; i < debugc; i++) {
        free(debugv[i]);
        debugv[i] = NULL;
    }
    debugc = 0;
}

/* -1 -- not initialized
    0 -- logging is off
    1 -- logging is on
*/
int8_t _rnp_log_switch =
#ifdef NDEBUG
  -1 // lazy-initialize later
#else
  1 // always on in debug build
#endif
  ;

void
set_rnp_log_switch(int8_t value)
{
    _rnp_log_switch = value;
}

bool
rnp_log_switch()
{
    if (_rnp_log_switch < 0) {
        const char *var = getenv(RNP_LOG_CONSOLE);
        _rnp_log_switch = (var && strcmp(var, "0")) ? 1 : 0;
    }
    return !!_rnp_log_switch;
}

/* portable replacement for strcasecmp(3) */
int
rnp_strcasecmp(const char *s1, const char *s2)
{
    int n;

    for (; (n = tolower((uint8_t) *s1) - tolower((uint8_t) *s2)) == 0 && *s1; s1++, s2++) {
    }
    return n;
}

/* return the hexdump as a string */
char *
rnp_strhexdump_upper(char *dest, const uint8_t *src, size_t length, const char *sep)
{
    unsigned i;
    int      n;

    for (n = 0, i = 0; i < length; i += 2) {
        n += snprintf(&dest[n], 3, "%02X", *src++);
        n += snprintf(&dest[n], 10, "%02X%s", *src++, sep);
    }
    return dest;
}

static char *
vcompose_path(char **buf, size_t *buf_len, const char *first, va_list ap)
{
    size_t curlen = 0;
    char * tmp_buf = NULL;
    size_t tmp_buf_len = 0;

    if (!first) {
        return NULL;
    }
    if (!buf) {
        buf = &tmp_buf;
    }
    if (!buf_len) {
        buf_len = &tmp_buf_len;
    }

    const char *s = first;
    do {
        size_t len = strlen(s);

        // current string len + NULL terminator + possible '/' +
        // len of this path component
        size_t reqsize = curlen + 1 + 1 + len;
        if (*buf_len < reqsize) {
            char *newbuf = (char *) realloc(*buf, reqsize);
            if (!newbuf) {
                // realloc failed, bail
                free(*buf);
                *buf = NULL;
                break;
            }
            *buf = newbuf;
            *buf_len = reqsize;
        }

        if (s != first) {
            if ((*buf)[curlen - 1] != '/' && *s != '/') {
                // add missing separator
                (*buf)[curlen] = '/';
                curlen += 1;
            } else if ((*buf)[curlen - 1] == '/' && *s == '/') {
                // skip duplicate separator
                s++;
                len--;
            }
        }
        memcpy(*buf + curlen, s, len + 1);
        curlen += len;
    } while ((s = va_arg(ap, const char *)));

    return *buf;
}

/** compose a path from one or more components
 *
 *  Notes:
 *  - The final argument must be NULL.
 *  - The caller must free the returned buffer.
 *  - The returned buffer is always NULL-terminated.
 *
 *  @param first the first path component
 *  @return the composed path buffer. The caller must free it.
 */
char *
rnp_compose_path(const char *first, ...)
{
    va_list ap;
    va_start(ap, first);
    char *path = vcompose_path(NULL, NULL, first, ap);
    va_end(ap);
    return path;
}

/** compose a path from one or more components
 *
 *  This version is useful when a function is composing
 *  multiple paths and wants to try to avoid unnecessary
 *  allocations.
 *
 *  Notes:
 *  - The final argument must be NULL.
 *  - The caller must free the returned buffer.
 *  - The returned buffer is always NULL-terminated.
 *
 *  @code
 *  char *buf = NULL;
 *  size_t buf_len = 0;
 *  rnp_compose_path_ex(&buf, &buf_len, "/tmp", dir1, file1, NULL);
 *  // the calls below will realloc the buffer if needed
 *  rnp_compose_path_ex(&buf, &buf_len, "/tmp", dir3, NULL);
 *  rnp_compose_path_ex(&buf, &buf_len, "/tmp", something, NULL);
 *  free(buf);
 *  @endcode
 *
 *  @param buf pointer to the buffer where the result will be stored.
 *         If buf is NULL, the caller must use the returned value.
 *         If *buf is NULL, a new buffer will be allocated.
 *  @param buf_len pointer to the allocated buffer size.
 *         Can be NULL.
 *  @param first the first path component
 *  @return the composed path buffer. The caller must free it.
 */
char *
rnp_compose_path_ex(char **buf, size_t *buf_len, const char *first, ...)
{
    va_list ap;
    va_start(ap, first);
    char *path = vcompose_path(buf, buf_len, first, ap);
    va_end(ap);
    return path;
}

bool
rnp_hex_encode(
  const uint8_t *buf, size_t buf_len, char *hex, size_t hex_len, rnp_hex_format_t format)
{
    uint32_t flags = format == RNP_HEX_LOWERCASE ? BOTAN_FFI_HEX_LOWER_CASE : 0;

    if (hex_len < (buf_len * 2 + 1)) {
        return false;
    }
    hex[buf_len * 2] = '\0';
    return botan_hex_encode(buf, buf_len, hex, flags) == 0;
}

size_t
rnp_hex_decode(const char *hex, uint8_t *buf, size_t buf_len)
{
    size_t hexlen = strlen(hex);

    /* check for 0x prefix */
    if ((hexlen >= 2) && (hex[0] == '0') && ((hex[1] == 'x') || (hex[1] == 'X'))) {
        hex += 2;
        hexlen -= 2;
    }
    if (botan_hex_decode(hex, hexlen, buf, &buf_len) != 0) {
        RNP_LOG("Hex decode failed on string: %s", hex);
        return 0;
    }
    return buf_len;
}

char *
rnp_strlwr(char *s)
{
    char *p = s;
    while (*p) {
        *p = tolower((unsigned char) *p);
        p++;
    }
    return s;
}

/* convert hex string, probably prefixes with 0x, to binary form */
bool
hex2bin(const char *hex, size_t hexlen, uint8_t *bin, size_t len, size_t *out)
{
    *out = rnp_hex_decode(hex, bin, len);
    return *out != 0;
}

/* Shortcut function to add field checking it for null to avoid allocation failure.
   Please note that it deallocates val on failure. */
bool
obj_add_field_json(json_object *obj, const char *name, json_object *val)
{
    if (!val) {
        return false;
    }
    // TODO: in JSON-C 0.13 json_object_object_add returns bool instead of void
    json_object_object_add(obj, name, val);
    if (!json_object_object_get_ex(obj, name, NULL)) {
        json_object_put(val);
        return false;
    }

    return true;
}

bool
obj_add_hex_json(json_object *obj, const char *name, const uint8_t *val, size_t val_len)
{
    if (val_len > 1024 * 1024) {
        RNP_LOG("too large json hex field: %zu", val_len);
        val_len = 1024 * 1024;
    }

    char   smallbuf[64] = {0};
    size_t hexlen = val_len * 2 + 1;

    char *hexbuf = hexlen < sizeof(smallbuf) ? smallbuf : (char *) malloc(hexlen);
    if (!hexbuf) {
        return false;
    }

    bool res = rnp_hex_encode(val, val_len, hexbuf, hexlen, RNP_HEX_LOWERCASE) &&
               obj_add_field_json(obj, name, json_object_new_string(hexbuf));

    if (hexbuf != smallbuf) {
        free(hexbuf);
    }
    return res;
}

bool
array_add_element_json(json_object *obj, json_object *val)
{
    if (!val) {
        return false;
    }
    if (json_object_array_add(obj, val)) {
        json_object_put(val);
        return false;
    }
    return true;
}
