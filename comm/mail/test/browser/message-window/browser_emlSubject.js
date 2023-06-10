/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Tests that opening an .eml file with empty subject works.
 */

"use strict";

var { open_message_from_file } = ChromeUtils.import(
  "resource://testing-common/mozmill/FolderDisplayHelpers.jsm"
);
var { close_window } = ChromeUtils.import(
  "resource://testing-common/mozmill/WindowHelpers.jsm"
);

var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { AppConstants } = ChromeUtils.import(
  "resource://gre/modules/AppConstants.jsm"
);

function check_eml_window_title(subject, eml) {
  let file = new FileUtils.File(getTestFilePath(`data/${eml}`));
  let msgc = open_message_from_file(file);

  let brandBundle = Services.strings.createBundle(
    "chrome://branding/locale/brand.properties"
  );
  let productName = brandBundle.GetStringFromName("brandFullName");
  let expectedTitle = subject;
  if (expectedTitle && AppConstants.platform != "macosx") {
    expectedTitle += " - ";
  }

  if (!expectedTitle || AppConstants.platform != "macosx") {
    expectedTitle += productName;
  }

  Assert.equal(msgc.window.document.title, expectedTitle);
  close_window(msgc);
}

add_task(function test_eml_empty_subject() {
  check_eml_window_title("", "./emptySubject.eml");
});

add_task(function test_eml_normal_subject() {
  check_eml_window_title("An email", "./evil.eml");
});
