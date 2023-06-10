/*
 * Copyright (c) 2017-2020 [Ribose Inc](https://www.ribose.com).
 * All rights reserved.
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
#ifndef RNP_UTILS_H_
#define RNP_UTILS_H_

#include <stdio.h>
#include "types.h"
#include <limits.h>
#include <rnp/rnp_export.h>

#define RNP_MSG(msg) (void) fprintf(stdout, msg);

// TODO: It is currently necessary to mark this with RNP_API, but this should
// be removed at some point since it is not part of the public API.
RNP_API bool rnp_log_switch();
void         set_rnp_log_switch(int8_t);

#define RNP_LOG_FD(fd, ...)                                                  \
    do {                                                                     \
        if (!rnp_log_switch())                                               \
            break;                                                           \
        (void) fprintf((fd), "[%s() %s:%d] ", __func__, __FILE__, __LINE__); \
        (void) fprintf((fd), __VA_ARGS__);                                   \
        (void) fprintf((fd), "\n");                                          \
    } while (0)

#define RNP_LOG(...) RNP_LOG_FD(stderr, __VA_ARGS__)

#define RNP_LOG_KEY(msg, key)                                                          \
    do {                                                                               \
        if (!(key)) {                                                                  \
            RNP_LOG(msg, "(null)");                                                    \
            break;                                                                     \
        }                                                                              \
        char                keyid[PGP_KEY_ID_SIZE * 2 + 1] = {0};                      \
        const pgp_key_id_t &id = key->keyid();                                         \
        rnp_hex_encode(id.data(), id.size(), keyid, sizeof(keyid), RNP_HEX_LOWERCASE); \
        RNP_LOG(msg, keyid);                                                           \
    } while (0)

#define RNP_LOG_KEY_PKT(msg, key)                                                     \
    do {                                                                              \
        pgp_key_id_t keyid = {};                                                      \
        if (pgp_keyid(keyid, (key))) {                                                \
            RNP_LOG(msg, "unknown");                                                  \
            break;                                                                    \
        };                                                                            \
        char keyidhex[PGP_KEY_ID_SIZE * 2 + 1] = {0};                                 \
        rnp_hex_encode(                                                               \
          keyid.data(), keyid.size(), keyidhex, sizeof(keyidhex), RNP_HEX_LOWERCASE); \
        RNP_LOG(msg, keyidhex);                                                       \
    } while (0)

#define RNP_DLOG(...)                    \
    if (rnp_get_debug(__FILE__)) {       \
        RNP_LOG_FD(stderr, __VA_ARGS__); \
    }

#define RNP_DHEX(msg, mem, len)         \
    if (rnp_get_debug(__FILE__)) {      \
        hexdump(stderr, msg, mem, len); \
    }

/* number of elements in an array */
#define ARRAY_SIZE(a) (sizeof(a) / sizeof(*(a)))

#define CHECK(exp, val, err)                          \
    do {                                              \
        if ((exp) != (val)) {                         \
            RNP_LOG("ERROR: (" #exp ")!=(" #val ")"); \
            ret = (err);                              \
            goto end;                                 \
        }                                             \
    } while (false)

/*
 * @params
 * array:       array of the structures to lookup
 * id_field     name of the field to compare against
 * ret_field    filed to return
 * lookup_value lookup value
 * ret          return value
 */
#define ARRAY_LOOKUP_BY_ID(array, id_field, ret_field, lookup_value, ret) \
    do {                                                                  \
        for (size_t i__ = 0; i__ < ARRAY_SIZE(array); i__++) {            \
            if ((array)[i__].id_field == (lookup_value)) {                \
                (ret) = (array)[i__].ret_field;                           \
                break;                                                    \
            }                                                             \
        }                                                                 \
    } while (0)

/*
 * @params
 * array:       array of the structures to lookup
 * str_field    name of the field to compare against
 * ret_field    filed to return
 * lookup_value lookup value
 * ret          return value
 */
#define ARRAY_LOOKUP_BY_STRCASE(array, str_field, ret_field, lookup_value, ret) \
    do {                                                                        \
        for (size_t i__ = 0; i__ < ARRAY_SIZE(array); i__++) {                  \
            if (!rnp_strcasecmp((array)[i__].str_field, (lookup_value))) {      \
                (ret) = static_cast<decltype(ret)>(((array)[i__].ret_field));   \
                break;                                                          \
            }                                                                   \
        }                                                                       \
    } while (0)

/* Formating helpers */
#define PRItime "ll"

#ifdef _WIN32
#define PRIsize "I"
#else
#define PRIsize "z"
#endif

/* TODO: Review usage of this variable */
#define RNP_BUFSIZ 8192

/* for silencing unused parameter warnings */
#define RNP_USED(x) /*LINTED*/ (void) &(x)

#ifndef RNP_CONST_TO_VOID_PTR
#define RNP_CONST_TO_VOID_PTR(a) (reinterpret_cast<void *>(const_cast<char *>(a)))
#endif

int rnp_mkdir(const char *path);
#ifdef _WIN32
#define RNP_MKDIR(pathname, mode) rnp_mkdir(pathname)
#else
#define RNP_MKDIR(pathname, mode) mkdir(pathname, mode)
#endif

/* debugging helpers*/
void hexdump(FILE *, const char *, const uint8_t *, size_t);

const char *pgp_str_from_map(int, pgp_map_t *);

/* debugging, reflection and information */
bool rnp_set_debug(const char *);
bool rnp_get_debug(const char *);
void rnp_clear_debug();

/* environment variable name */
static const char RNP_LOG_CONSOLE[] = "RNP_LOG_CONSOLE";

/* Portable way to convert bits to bytes */

#define BITS_TO_BYTES(b) (((b) + (CHAR_BIT - 1)) / CHAR_BIT)

/* Load little-endian 32-bit from y to x in portable fashion */

inline void
LOAD32LE(uint32_t &x, uint8_t y[4])
{
    x = (static_cast<uint32_t>(y[3]) << 24) | (static_cast<uint32_t>(y[2]) << 16) |
        (static_cast<uint32_t>(y[1]) << 8) | (static_cast<uint32_t>(y[0]) << 0);
}

/* Store big-endian 32-bit value x in y */
inline void
STORE32BE(uint8_t x[4], uint32_t y)
{
    x[0] = (uint8_t)(y >> 24) & 0xff;
    x[1] = (uint8_t)(y >> 16) & 0xff;
    x[2] = (uint8_t)(y >> 8) & 0xff;
    x[3] = (uint8_t)(y >> 0) & 0xff;
}

/* Store big-endian 64-bit value x in y */
inline void
STORE64BE(uint8_t x[8], uint64_t y)
{
    x[0] = (uint8_t)(y >> 56) & 0xff;
    x[1] = (uint8_t)(y >> 48) & 0xff;
    x[2] = (uint8_t)(y >> 40) & 0xff;
    x[3] = (uint8_t)(y >> 32) & 0xff;
    x[4] = (uint8_t)(y >> 24) & 0xff;
    x[5] = (uint8_t)(y >> 16) & 0xff;
    x[6] = (uint8_t)(y >> 8) & 0xff;
    x[7] = (uint8_t)(y >> 0) & 0xff;
}

#ifndef MAX
#define MAX(a, b) (((a) > (b)) ? (a) : (b))
#endif

inline char *
getenv_logname(void)
{
    char *name = getenv("LOGNAME");
    if (!name) {
        name = getenv("USER");
    }
    return name;
}

#endif
