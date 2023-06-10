/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Tests for OpenPGP encryption alias rules.
 */

"use strict";

const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
const { OpenPGPTestUtils } = ChromeUtils.import(
  "resource://testing-common/mozmill/OpenPGPTestUtils.jsm"
);
const { EnigmailFuncs } = ChromeUtils.import(
  "chrome://openpgp/content/modules/funcs.jsm"
);
const uidHelper = ChromeUtils.import(
  "chrome://openpgp/content/modules/uidHelper.jsm"
).uidHelper;

const tests = [
  {
    input: "Cherry Blossom (桜の花) (description) <email@example.com>",
    email: "email@example.com",
  },
  {
    input:
      "Cherry Blossom (桜の花) (description) (more information) <email@example.com>",
    email: "email@example.com",
  },
  {
    input: "First Last <email@example.com>",
    email: "email@example.com",
  },
  {
    input: "Last, First <email@example.com>",
    email: "email@example.com",
  },
  {
    input: "email@example.com",
    email: "email@example.com",
  },
  {
    input: "<email@example.com>",
    email: "email@example.com",
  },
  {
    input: "First Last email@example.com>",
    email: "",
  },
  {
    input: "First Last (comment) <email@example.com>",
    email: "email@example.com",
  },
  {
    input: "First Last (a) (b) (c) (comment) <email@example.com>",
    email: "email@example.com",
  },
  {
    input: "First Last (comment <email@example.com>",
    email: "email@example.com",
  },
  {
    input: "First Last )comment) <email@example.com>",
    email: "email@example.com",
  },
  {
    input: "",
    email: "",
  },
  {
    input: "First Last () <>",
    email: "",
  },
  {
    input: "First Last () <> <> <>",
    email: "",
  },
  {
    input: "First Last () <> <email1@example.com>",
    email: "",
  },
  {
    input: "First <Last> (comment) <email1@example.com>",
    email: "",
  },
  {
    input: "First Last <email@example.com> (bad comment)",
    email: "email@example.com",
  },
  {
    input: "First Last <email@example.com> extra text",
    email: "email@example.com",
  },
  {
    input: "First Last <not-an-email> extra text",
    email: "",
  },
  {
    input: "First Last (comment (nested)) <email@example.com>",
    email: "email@example.com",
  },
  {
    input:
      "First Last (comment (no second closing bracket) <email@example.com>",
    email: "email@example.com",
  },
  {
    input: "<a@example.org b@example.org>",
    email: "",
  },
  {
    input: "<a@@example.org>",
    email: "",
  },
];

/**
 * Initialize OpenPGP add testing keys.
 */
add_task(async function setUp() {
  do_get_profile();

  await OpenPGPTestUtils.initOpenPGP();
});

add_task(async function testAlias() {
  for (let test of tests) {
    console.debug("testing input: " + test.input);

    let email = EnigmailFuncs.getEmailFromUserID(test.input);

    Assert.equal(test.email, email);
  }
});

add_task(async function testUidHelper() {
  let splitUid = {};
  uidHelper.getPartsFromUidStr(
    "First Last (comment1) (comment2) <email@example.com>",
    splitUid
  );
  Assert.equal(
    splitUid.email,
    "email@example.com",
    "uidHelper should be able to extract email"
  );
  Assert.equal(
    splitUid.name,
    "First Last (comment1) (comment2)",
    "uidHelper should be able to extract name"
  );
});
