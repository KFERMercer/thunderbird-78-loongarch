/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Tests that messages with "broken" base64 are correctly displayed.
 */

"use strict";

var { open_message_from_file } = ChromeUtils.import(
  "resource://testing-common/mozmill/FolderDisplayHelpers.jsm"
);
var { close_window } = ChromeUtils.import(
  "resource://testing-common/mozmill/WindowHelpers.jsm"
);

add_task(function test_base64_display() {
  let file = new FileUtils.File(
    getTestFilePath("data/base64-with-whitespace.eml")
  );
  let msgc = open_message_from_file(file);
  let bodyText = msgc.e("messagepane").contentDocument.querySelector("body")
    .textContent;
  close_window(msgc);

  Assert.ok(
    bodyText.includes("abcdefghijklmnopqrstuvwxyz"),
    "Decode base64 body from message."
  );
});

add_task(async function test_base64_display2() {
  let file = new FileUtils.File(getTestFilePath("data/base64-bug1586890.eml"));
  let msgc = await open_message_from_file(file);
  let bodyText = msgc.e("messagepane").contentDocument.querySelector("body")
    .textContent;
  close_window(msgc);

  Assert.ok(
    bodyText.includes("abcdefghijklm"),
    "Decode base64 body from UTF-16 message with broken charset."
  );
});
