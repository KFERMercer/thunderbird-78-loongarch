/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Tests that attached messages (message/rfc822) are correctly sent.
 * It's easiest to test the forward case.
 */

"use strict";

var {
  close_compose_window,
  get_msg_source,
  open_compose_with_forward_as_attachments,
} = ChromeUtils.import("resource://testing-common/mozmill/ComposeHelpers.jsm");
var {
  be_in_folder,
  get_special_folder,
  mc,
  open_message_from_file,
  press_delete,
  select_click_row,
} = ChromeUtils.import(
  "resource://testing-common/mozmill/FolderDisplayHelpers.jsm"
);
var { close_window } = ChromeUtils.import(
  "resource://testing-common/mozmill/WindowHelpers.jsm"
);

var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { MailServices } = ChromeUtils.import(
  "resource:///modules/MailServices.jsm"
);

var gDrafts;

add_task(function setupModule(module) {
  gDrafts = get_special_folder(Ci.nsMsgFolderFlags.Drafts, true);
});

function forwardDirect(aFilePath, aExpectedText) {
  let file = new FileUtils.File(getTestFilePath(`data/${aFilePath}`));
  let msgc = open_message_from_file(file);

  let cwc = open_compose_with_forward_as_attachments(msgc);

  // Ctrl+S saves as draft.
  cwc.keypress(null, "s", { shiftKey: false, accelKey: true });

  close_compose_window(cwc);
  close_window(msgc);

  be_in_folder(gDrafts);
  let draftMsg = select_click_row(0);

  let draftMsgContent = get_msg_source(draftMsg);

  Assert.ok(
    draftMsgContent.includes(aExpectedText),
    "Failed to find expected text"
  );

  press_delete(mc); // clean up the created draft
}

add_task(function test_forwarding_long_html_line_as_attachment() {
  forwardDirect("./long-html-line.eml", "We like writing long lines.");
});

add_task(function test_forwarding_feed_message_as_attachment() {
  forwardDirect("./feed-message.eml", "We like using linefeeds only.");
});
