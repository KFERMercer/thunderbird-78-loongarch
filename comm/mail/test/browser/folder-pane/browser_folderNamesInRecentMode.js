/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Test that the folder names have account name appended when in "recent" view.
 */

"use strict";

var {
  assert_folder_at_index_as,
  assert_folder_mode,
  assert_folder_tree_view_row_count,
  be_in_folder,
  make_new_sets_in_folder,
  mc,
} = ChromeUtils.import(
  "resource://testing-common/mozmill/FolderDisplayHelpers.jsm"
);

var { MailServices } = ChromeUtils.import(
  "resource:///modules/MailServices.jsm"
);
var { fixIterator } = ChromeUtils.import(
  "resource:///modules/iteratorUtils.jsm"
);

add_task(function setupModule(module) {
  assert_folder_mode("all");
  assert_folder_tree_view_row_count(7);
});

add_task(function test_folder_names_in_recent_view_mode() {
  // We need 2 local accounts that have pristine folders with
  // unmodified times, so that it does not influence the
  // list of Recent folders. So clear out the most-recently-used time.
  for (let acc of MailServices.accounts.accounts) {
    for (let fld of fixIterator(
      acc.incomingServer.rootFolder.subFolders,
      Ci.nsIMsgFolder
    )) {
      fld.setStringProperty("MRUTime", "0");
    }
  }

  let acc1 = MailServices.accounts.accounts[1];
  let acc2 = MailServices.accounts.accounts[0];
  let rootFolder1 = acc1.incomingServer.rootFolder;
  let rootFolder2 = acc2.incomingServer.rootFolder;

  // Create some test folders.
  rootFolder1.createSubfolder("uniqueName", null);
  rootFolder1.createSubfolder("duplicatedName", null);
  rootFolder2.createSubfolder("duplicatedName", null);
  let inbox2 = rootFolder2.getFolderWithFlags(Ci.nsMsgFolderFlags.Inbox);
  inbox2.createSubfolder("duplicatedName", null);

  let fUnique = rootFolder1.getChildNamed("uniqueName");
  let fDup1 = rootFolder1.getChildNamed("duplicatedName");
  let fDup2 = rootFolder2.getChildNamed("duplicatedName");
  let fDup3 = inbox2.getChildNamed("duplicatedName");
  assert_folder_tree_view_row_count(10);

  // Create some messages in the folders to make them recently used.
  make_new_sets_in_folder(fUnique, [{ count: 1 }]);
  be_in_folder(fUnique);
  make_new_sets_in_folder(fDup1, [{ count: 1 }]);
  be_in_folder(fDup1);
  make_new_sets_in_folder(fDup2, [{ count: 2 }]);
  be_in_folder(fDup2);
  make_new_sets_in_folder(fDup3, [{ count: 3 }]);
  be_in_folder(fDup3);

  mc.window.gFolderTreeView.mode = "recent_compact";

  // Check displayed folder names. In Recent mode the folders are sorted alphabetically
  assert_folder_at_index_as(0, "duplicatedName - Local Folders (1)");
  assert_folder_at_index_as(1, "duplicatedName - tinderbox@foo.invalid (3)");
  assert_folder_at_index_as(2, "duplicatedName - tinderbox@foo.invalid (2)");
  assert_folder_at_index_as(3, "uniqueName - Local Folders (1)");
  assert_folder_tree_view_row_count(4);

  // Remove our folders to clean up.
  rootFolder1.propagateDelete(fUnique, true, null);
  rootFolder1.propagateDelete(fDup1, true, null);
  rootFolder2.propagateDelete(fDup2, true, null);
  rootFolder2.propagateDelete(fDup3, true, null);
});

registerCleanupFunction(function teardownModule() {
  mc.window.gFolderTreeView.mode = "all";
  assert_folder_tree_view_row_count(7);

  document.getElementById("folderTree").focus();

  Assert.report(
    false,
    undefined,
    undefined,
    "Test ran to completion successfully"
  );
});
