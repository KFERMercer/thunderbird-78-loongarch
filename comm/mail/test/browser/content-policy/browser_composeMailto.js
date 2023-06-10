/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var composeHelper = ChromeUtils.import(
  "resource://testing-common/mozmill/ComposeHelpers.jsm"
);
var { content_tab_eid, open_content_tab_with_url } = ChromeUtils.import(
  "resource://testing-common/mozmill/ContentTabHelpers.jsm"
);
var { mc } = ChromeUtils.import(
  "resource://testing-common/mozmill/FolderDisplayHelpers.jsm"
);
var { input_value } = ChromeUtils.import(
  "resource://testing-common/mozmill/KeyboardHelpers.jsm"
);
var {
  plan_for_modal_dialog,
  wait_for_modal_dialog,
  wait_for_window_close,
} = ChromeUtils.import("resource://testing-common/mozmill/WindowHelpers.jsm");

var folder = null;
var gMsgNo = 0;
var gComposeWin;
var gNewTab;
var gPreCount;

var url =
  "http://mochi.test:8888/browser/comm/mail/test/browser/content-policy/html/";

add_task(function test_openComposeFromMailToLink() {
  // Open a content tab with the mailto link in it.
  // To open a tab we're going to have to cheat and use tabmail so we can load
  // in the data of what we want.
  gPreCount = mc.tabmail.tabContainer.allTabs.length;
  gNewTab = open_content_tab_with_url(url + "mailtolink.html");
  gComposeWin = composeHelper.open_compose_with_element_click(
    content_tab_eid(gNewTab, "mailtolink")
  );
});

add_task(function test_checkInsertImage() {
  // First focus on the editor element
  gComposeWin.e("content-frame").focus();

  // Now open the image window
  plan_for_modal_dialog("Mail:image", function insert_image(mwc) {
    // Insert the url of the image.
    let srcloc = mwc.window.document.getElementById("srcInput");
    srcloc.focus();

    input_value(mwc, url + "pass.png");
    mwc.sleep(0);

    // Don't add alternate text
    mwc.click(mwc.eid("noAltTextRadio"));

    // Accept the dialog
    mwc.window.document.querySelector("dialog").acceptDialog();
  });
  gComposeWin.click(gComposeWin.eid("insertImage"));

  wait_for_modal_dialog();
  wait_for_window_close();

  //  gComposeWin.sleep(500);

  // Test that the image load has not been denied
  let childImages = gComposeWin
    .e("content-frame")
    .contentDocument.getElementsByTagName("img");

  if (childImages.length != 1) {
    throw new Error(
      "Expecting one image in document, actually have " + childImages.length
    );
  }

  // Should be the only image, so just check the first.
  if (childImages[0].imageBlockingStatus != Ci.nsIContentPolicy.ACCEPT) {
    throw new Error(
      "Loading of image has been unexpectedly blocked in a mailto compose window"
    );
  }
});

add_task(function test_closeComposeWindowAndTab() {
  composeHelper.close_compose_window(gComposeWin);

  mc.tabmail.closeTab(gNewTab);

  if (mc.tabmail.tabContainer.allTabs.length != gPreCount) {
    throw new Error("The content tab didn't close");
  }

  Assert.report(
    false,
    undefined,
    undefined,
    "Test ran to completion successfully"
  );
});
