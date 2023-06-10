/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var { mc } = ChromeUtils.import(
  "resource://testing-common/mozmill/FolderDisplayHelpers.jsm"
);

add_task(function test_messagepane_extension_points_exist() {
  mc.assertNode(mc.eid("messagepanewrapper"));

  Assert.report(
    false,
    undefined,
    undefined,
    "Test ran to completion successfully"
  );
});
