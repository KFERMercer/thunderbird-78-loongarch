/* -*- Mode: C; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
/* #include <sys/regdef.h> */
/* #include <sys/asm.h> */
#include "xptc_asm_loongarch_unix.h"

.text
.globl  invoke_count_words
.globl  invoke_copy_to_stack

# a0, a1, a2, a3, s0, ra, gp
#define LOCALSZ 7
#define FRAMESZ  ((((NARGSAVE + LOCALSZ) * SZREG) + ALSZ) & ALMASK)

#define RAOFF (FRAMESZ -(1 * SZREG))
#define A0OFF (FRAMESZ -(2 * SZREG))
#define A1OFF (FRAMESZ -(3 * SZREG))
#define A2OFF (FRAMESZ -(4 * SZREG))
#define A3OFF (FRAMESZ -(5 * SZREG))
#define S0OFF (FRAMESZ -(6 * SZREG))
#define GPOFF (FRAMESZ -(7 * SZREG))

#
# _NS_InvokeByIndex(that, methodIndex, paramCount, params)
#                      a0       a1          a2         a3

    .text;
    .globl _NS_InvokeByIndex;
    .align 2;
    .type _NS_InvokeByIndex,@function;
_NS_InvokeByIndex:
    addi.d    t0, zero, FRAMESZ
    sub.d     sp, sp, t0

    st.d      ra, sp, RAOFF
    st.d      a0, sp, A0OFF
    st.d      a1, sp, A1OFF
    st.d      a2, sp, A2OFF
    st.d      a3, sp, A3OFF
    st.d      s0, sp, S0OFF

    # invoke_count_words(paramCount, params)
    addi.d    a0, a2, 0
    addi.d    a1, a3, 0
    bl        invoke_count_words

    # invoke_copy_to_stack(uint32_t* d, uint32_t paramCount,
    #                      nsXPTCVariant* s, uint32_t *reg)

    # save sp before we copy the params to the stack
    addi.d    t0, sp, 0

    # assume full size of 16 bytes per param to be safe
    slli.d    v0, v0, 4     # 16 bytes * num params
    sub.d     sp, sp, v0    # make room
    addi.d    a0, sp, 0     # a0 - param stack address

    ld.d      a1, t0, A2OFF  # a1 - paramCount
    ld.d      a2, t0, A3OFF  # a2 - params

    # create temporary stack space to write int and fp regs
    addi.d    t1, zero, 128
    sub.d     sp, sp, t1      # 128 = 16 regs of 8 bytes
    addi.d    a3, sp, 0

    # save the old sp and save the arg stack
    addi.d    t1, zero, 16
    sub.d     sp, sp, t1
    st.d      t0, sp, 0
    st.d      a0, sp, 8

    # copy the param into the stack areas
    bl        invoke_copy_to_stack

    ld.d      t3, sp, 8    # get previous a0
    ld.d      s0, sp, 0     # get orig sp back and save away our stack pointer

    ld.d      a0, s0, A0OFF  # a0 - that
    ld.d      a1, s0, A1OFF  # a1 - methodIndex

    # t1 = methodIndex * pow(2, PTRLOG)
    # (use shift instead of mult)
    slli.d    t1, a1, PTRLOG

    # calculate the function we need to jump to
    ld.d      t7, a0, 0
    add.d     t7, t7, t1
    ld.d      t7, t7, 0

    # get register save area from invoke_copy_to_stack
    addi.d    t1, zero, 128
    sub.d     t1, t3, t1

    # a1..a7 and fa0..fa7 should now be set to what
    # invoke_copy_to_stack told us. skip a0
    # because that's the "this" pointer

    ld.d      a1, t1, 0
    ld.d      a2, t1, 8
    ld.d      a3, t1, 16
    ld.d      a4, t1, 24
    ld.d      a5, t1, 32
    ld.d      a6, t1, 40
    ld.d      a7, t1, 48

    fld.d     fa0, t1, 56
    fld.d     fa1, t1, 64
    fld.d     fa2, t1, 72
    fld.d     fa3, t1, 80
    fld.d     fa4, t1, 88
    fld.d     fa5, t1, 96
    fld.d     fa6, t1, 104
    fld.d     fa7, t1, 112

    # create the stack pointer for the function
    addi.d    sp, t3, 0

    jirl      ra, t7, 0

    # restore stack pointer.
    addi.d    sp, s0, 0

    ld.d      ra, sp, RAOFF
    ld.d      s0, sp, S0OFF
    addi.d    sp, sp, FRAMESZ
    jirl      zero, ra, 0
    