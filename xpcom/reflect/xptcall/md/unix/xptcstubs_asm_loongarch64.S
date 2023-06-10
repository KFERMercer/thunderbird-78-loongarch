/* -*- Mode: C; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
/* #include <sys/regdef.h> */
/* #include <sys/asm.h> */
#include "xptc_asm_loongarch_unix.h"

#define LOCALSZ 16
#define FRAMESZ ((((NARGSAVE + LOCALSZ) * SZREG) + ALSZ) & ALMASK)

#define A1OFF (FRAMESZ - (8 * SZREG))
#define A2OFF (FRAMESZ - (7 * SZREG))
#define A3OFF (FRAMESZ - (6 * SZREG))
#define A4OFF (FRAMESZ - (5 * SZREG))
#define A5OFF (FRAMESZ - (4 * SZREG))
#define A6OFF (FRAMESZ - (3 * SZREG))
#define A7OFF (FRAMESZ - (2 * SZREG))
#define RAOFF (FRAMESZ - (1 * SZREG))

#define FA0OFF (FRAMESZ - (16 * SZREG))
#define FA1OFF (FRAMESZ - (15 * SZREG))
#define FA2OFF (FRAMESZ - (14 * SZREG))
#define FA3OFF (FRAMESZ - (13 * SZREG))
#define FA4OFF (FRAMESZ - (12 * SZREG))
#define FA5OFF (FRAMESZ - (11 * SZREG))
#define FA6OFF (FRAMESZ - (10 * SZREG))
#define FA7OFF (FRAMESZ - (9 * SZREG))

#define SENTINEL_ENTRY(n)         /* defined in cpp file, not here */

#define STUB_ENTRY(x)                                        \
    .if x < 10;                                              \
    .globl    _ZN14nsXPTCStubBase5Stub ##x ##Ev;             \
    .type     _ZN14nsXPTCStubBase5Stub ##x ##Ev,@function;   \
_ZN14nsXPTCStubBase5Stub ##x ##Ev:;                          \
    addi.d    t0, zero, FRAMESZ;                             \
    sub.d     sp, sp, t0;                                    \
    addi.d    t0, zero, x;                                   \
    b         sharedstub;                                   \
    .elseif x < 100;                                         \
    .globl    _ZN14nsXPTCStubBase6Stub ##x ##Ev;             \
    .type     _ZN14nsXPTCStubBase6Stub ##x ##Ev,@function;   \
_ZN14nsXPTCStubBase6Stub ##x ##Ev:;                          \
    addi.d    t0, zero, FRAMESZ;                             \
    sub.d     sp, sp, t0;                                    \
    addi.d    t0, zero, x;                                   \
    b         sharedstub;                                   \
    .elseif x < 1000;                                        \
    .globl    _ZN14nsXPTCStubBase7Stub ##x ##Ev;             \
    .type     _ZN14nsXPTCStubBase7Stub ##x ##Ev,@function;   \
_ZN14nsXPTCStubBase7Stub ##x ##Ev:;                          \
    addi.d    t0, zero, FRAMESZ;                             \
    sub.d     sp, sp, t0;                                    \
    addi.d    t0, zero, x;                                   \
    b         sharedstub;                                   \
    .else;                                                   \
    .err;                                                    \
    .endif

#
# open a dummy frame for the function entries
#
    .text
    .align   2
    .type    dummy,@function
dummy:
#    .mask    0x90000FF0, RAOFF-FRAMESZ
#    .fmask   0x000FF000, F19OFF-FRAMESZ

#include "xptcstubsdef.inc"

sharedstub:
    st.d     a1, sp, A1OFF
    st.d     a2, sp, A2OFF
    st.d     a3, sp, A3OFF
    st.d     a4, sp, A4OFF
    st.d     a5, sp, A5OFF
    st.d     a6, sp, A6OFF
    st.d     a7, sp, A7OFF
    st.d     ra, sp, RAOFF

    fst.d    fa0, sp, FA0OFF
    fst.d    fa1, sp, FA1OFF
    fst.d    fa2, sp, FA2OFF
    fst.d    fa3, sp, FA3OFF
    fst.d    fa4, sp, FA4OFF
    fst.d    fa5, sp, FA5OFF
    fst.d    fa6, sp, FA6OFF
    fst.d    fa7, sp, FA7OFF

    # t0 is methodIndex
    add.d    a1, t0, zero

    # a2 is stack address where extra function params
    # are stored that do not fit in registers
    addi.d   a2, sp, FRAMESZ

    # a3 is stack address of a1..a7
    addi.d   a3, sp, A1OFF

    # a4 is stack address of fa0..fa7
    addi.d   a4, sp, FA0OFF

    # PrepareAndDispatch(that, methodIndex, args, gprArgs, fpArgs)
    #                     a0       a1        a2     a3       a4
    #
    bl       PrepareAndDispatch

    ld.d     ra, sp, RAOFF

    addi.d   sp, sp, FRAMESZ
    jirl     zero, ra, 0
    