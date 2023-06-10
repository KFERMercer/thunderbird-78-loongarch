/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * This tests various commands on messages. This is primarily for commands
 * that can't be tested with xpcshell tests because they're handling in the
 * front end - which is why Archive is the only command currently tested.
 */

"use strict";

var { wait_for_content_tab_load } = ChromeUtils.import(
  "resource://testing-common/mozmill/ContentTabHelpers.jsm"
);
var {
  add_sets_to_folders,
  archive_selected_messages,
  assert_selected_and_displayed,
  be_in_folder,
  close_popup,
  collapse_all_threads,
  create_folder,
  create_thread,
  make_display_threaded,
  make_display_unthreaded,
  make_new_sets_in_folder,
  mc,
  press_delete,
  right_click_on_row,
  select_click_row,
  select_control_click_row,
  select_shift_click_row,
  wait_for_popup_to_open,
} = ChromeUtils.import(
  "resource://testing-common/mozmill/FolderDisplayHelpers.jsm"
);
var { plan_for_modal_dialog, wait_for_modal_dialog } = ChromeUtils.import(
  "resource://testing-common/mozmill/WindowHelpers.jsm"
);

var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { MailServices } = ChromeUtils.import(
  "resource:///modules/MailServices.jsm"
);
var { MailUtils } = ChromeUtils.import("resource:///modules/MailUtils.jsm");

var unreadFolder, shiftDeleteFolder, threadDeleteFolder;
var archiveSrcFolder = null;
var archiveURI;

var acctMgr;
var tagArray;
var gAutoRead;

add_task(function setupModule(module) {
  gAutoRead = Services.prefs.getBoolPref("mailnews.mark_message_read.auto");
  Services.prefs.setBoolPref("mailnews.mark_message_read.auto", false);

  unreadFolder = create_folder("UnreadFolder");
  shiftDeleteFolder = create_folder("ShiftDeleteFolder");
  threadDeleteFolder = create_folder("ThreadDeleteFolder");
  archiveSrcFolder = create_folder("ArchiveSrc");

  make_new_sets_in_folder(unreadFolder, [{ count: 2 }]);
  make_new_sets_in_folder(shiftDeleteFolder, [{ count: 3 }]);
  add_sets_to_folders(
    [threadDeleteFolder],
    [create_thread(3), create_thread(3), create_thread(3)]
  );

  // Create messages from 20 different months, which will mean 2 different
  // years as well.
  make_new_sets_in_folder(archiveSrcFolder, [
    { count: 20, age_incr: { weeks: 5 } },
  ]);

  tagArray = MailServices.tags.getAllTags();
});

/**
 * Ensures that all messages have a particular read status
 * @param messages an array of nsIMsgDBHdrs to check
 * @param read true if the messages should be marked read, false otherwise
 */
function check_read_status(messages, read) {
  function read_str(read) {
    return read ? "read" : "unread";
  }

  for (let i = 0; i < messages.length; i++) {
    Assert.ok(
      messages[i].isRead == read,
      "Message marked as " +
        read_str(messages[i].isRead) +
        ", expected " +
        read_str(read)
    );
  }
}

/**
 * Ensures that the mark read/unread menu items are enabled/disabled properly
 * @param index the row in the thread pane of the message to query
 * @param canMarkRead true if the mark read item should be enabled
 * @param canMarkUnread true if the mark unread item should be enabled
 */
function check_read_menuitems(index, canMarkRead, canMarkUnread) {
  right_click_on_row(index);
  wait_for_popup_to_open(mc.e("mailContext"));
  mc.click_menus_in_sequence(mc.e("mailContext"), [{ id: "mailContext-mark" }]);

  let readEnabled = !mc.e("mailContext-markRead").disabled;
  let unreadEnabled = !mc.e("mailContext-markUnread").disabled;

  Assert.ok(
    readEnabled == canMarkRead,
    "Mark read menu item " +
      (canMarkRead ? "dis" : "en") +
      "abled when it shouldn't be!"
  );

  Assert.ok(
    unreadEnabled == canMarkUnread,
    "Mark unread menu item " +
      (canMarkUnread ? "dis" : "en") +
      "abled when it shouldn't be!"
  );
}

function enable_archiving(enabled) {
  Services.prefs.setBoolPref("mail.identity.default.archive_enabled", enabled);
}

/**
 * Mark a message read or unread via the context menu
 * @param index the row in the thread pane of the message to mark read/unread
 * @param read true the message should be marked read, false otherwise
 */
function mark_read_via_menu(index, read) {
  let menuItem = read ? "mailContext-markRead" : "mailContext-markUnread";
  right_click_on_row(index);
  wait_for_popup_to_open(mc.e("mailContext"));
  mc.click_menus_in_sequence(mc.e("mailContext"), [
    { id: "mailContext-mark" },
    { id: menuItem },
  ]);
  close_popup(mc, mc.eid("mailContext"));
}

add_task(function test_mark_one_read() {
  be_in_folder(unreadFolder);
  let curMessage = select_click_row(0);

  curMessage.markRead(false);
  mark_read_via_menu(0, true);
  check_read_status([curMessage], true);
});

add_task(function test_mark_one_unread() {
  be_in_folder(unreadFolder);
  let curMessage = select_click_row(0);

  curMessage.markRead(true);
  mark_read_via_menu(0, false);
  check_read_status([curMessage], false);
});

add_task(function test_mark_n_read() {
  be_in_folder(unreadFolder);
  select_click_row(0);
  let curMessages = select_shift_click_row(1);

  for (let i = 0; i < curMessages.length; i++) {
    curMessages[i].markRead(false);
  }
  mark_read_via_menu(0, true);
  check_read_status(curMessages, true);
});

add_task(function test_mark_n_unread() {
  be_in_folder(unreadFolder);
  select_click_row(0);
  let curMessages = select_shift_click_row(1);

  for (let i = 0; i < curMessages.length; i++) {
    curMessages[i].markRead(true);
  }
  mark_read_via_menu(0, false);
  check_read_status(curMessages, false);
});

add_task(function test_mark_n_read_mixed() {
  be_in_folder(unreadFolder);
  select_click_row(0);
  let curMessages = select_shift_click_row(1);

  curMessages[0].markRead(true);
  curMessages[1].markRead(false);
  mark_read_via_menu(0, true);
  check_read_status(curMessages, true);

  curMessages[0].markRead(false);
  curMessages[1].markRead(true);
  mark_read_via_menu(0, true);
  check_read_status(curMessages, true);
});

add_task(function test_mark_n_unread_mixed() {
  be_in_folder(unreadFolder);
  select_click_row(0);
  let curMessages = select_shift_click_row(1);

  curMessages[0].markRead(false);
  curMessages[1].markRead(true);
  mark_read_via_menu(0, false);
  check_read_status(curMessages, false);

  curMessages[0].markRead(true);
  curMessages[1].markRead(false);
  mark_read_via_menu(0, false);
  check_read_status(curMessages, false);
});

add_task(function test_toggle_read() {
  be_in_folder(unreadFolder);
  let curMessage = select_click_row(0);

  curMessage.markRead(false);
  mc.keypress(null, "m", {});
  check_read_status([curMessage], true);
});

add_task(function test_toggle_unread() {
  be_in_folder(unreadFolder);
  let curMessage = select_click_row(0);

  curMessage.markRead(true);
  mc.keypress(null, "m", {});
  check_read_status([curMessage], false);
});

add_task(function test_toggle_mixed() {
  be_in_folder(unreadFolder);
  select_click_row(0);
  let curMessages = select_shift_click_row(1);

  curMessages[0].markRead(false);
  curMessages[1].markRead(true);
  mc.keypress(null, "m", {});
  check_read_status(curMessages, true);

  curMessages[0].markRead(true);
  curMessages[1].markRead(false);
  mc.keypress(null, "m", {});
  check_read_status(curMessages, false);
});

add_task(function test_mark_menu_read() {
  be_in_folder(unreadFolder);
  let curMessage = select_click_row(0);

  curMessage.markRead(false);
  check_read_menuitems(0, true, false);
});

add_task(function test_mark_menu_unread() {
  be_in_folder(unreadFolder);
  let curMessage = select_click_row(0);

  curMessage.markRead(true);
  check_read_menuitems(0, false, true);
});

add_task(function test_mark_menu_mixed() {
  be_in_folder(unreadFolder);
  select_click_row(0);
  let curMessages = select_shift_click_row(1);

  curMessages[0].markRead(false);
  curMessages[1].markRead(true);

  check_read_menuitems(0, true, true);
});

add_task(function test_mark_all_read() {
  be_in_folder(unreadFolder);
  let curMessage = select_click_row(0);
  curMessage.markRead(false);

  // Make sure we can mark all read with >0 messages unread.
  right_click_on_row(0);
  wait_for_popup_to_open(mc.e("mailContext"));
  mc.click_menus_in_sequence(mc.e("mailContext"), [
    { id: "mailContext-mark" },
    { id: "mailContext-markAllRead" },
  ]);
  close_popup(mc, mc.eid("mailContext"));

  Assert.ok(curMessage.isRead, "Message should have been marked read!");

  // Make sure we can't mark all read, now that all messages are already read.
  right_click_on_row(0);
  wait_for_popup_to_open(mc.e("mailContext"));
  mc.click_menus_in_sequence(mc.e("mailContext"), [{ id: "mailContext-mark" }]);

  let allReadDisabled = mc.e("mailContext-markAllRead").disabled;
  Assert.ok(allReadDisabled, "Mark All Read menu item should be disabled!");
});

add_task(function test_shift_delete_prompt() {
  be_in_folder(shiftDeleteFolder);
  let curMessage = select_click_row(0);

  // First, try shift-deleting and then cancelling at the prompt.
  Services.prefs.setBoolPref("mail.warn_on_shift_delete", true);
  plan_for_modal_dialog("commonDialogWindow", function(controller) {
    controller.window.document
      .querySelector("dialog")
      .getButton("cancel")
      .doCommand();
  });
  // We don't use press_delete here because we're not actually deleting this
  // time!
  SimpleTest.ignoreAllUncaughtExceptions(true);
  mc.keypress(null, "VK_DELETE", { shiftKey: true });
  SimpleTest.ignoreAllUncaughtExceptions(false);
  wait_for_modal_dialog("commonDialogWindow");
  // Make sure we didn't actually delete the message.
  Assert.equal(curMessage, select_click_row(0));

  // Second, try shift-deleting and then accepting the deletion.
  plan_for_modal_dialog("commonDialogWindow", function(controller) {
    controller.window.document
      .querySelector("dialog")
      .getButton("accept")
      .doCommand();
  });
  press_delete(mc, { shiftKey: true });
  wait_for_modal_dialog("commonDialogWindow");
  // Make sure we really did delete the message.
  Assert.notEqual(curMessage, select_click_row(0));

  // Finally, try shift-deleting when we turned off the prompt.
  Services.prefs.setBoolPref("mail.warn_on_shift_delete", false);
  curMessage = select_click_row(0);
  press_delete(mc, { shiftKey: true });
  wait_for_modal_dialog("commonDialogWindow");
  // Make sure we really did delete the message.
  Assert.notEqual(curMessage, select_click_row(0));

  Services.prefs.clearUserPref("mail.warn_on_shift_delete");
});

add_task(function test_thread_delete_prompt() {
  be_in_folder(threadDeleteFolder);
  make_display_threaded();
  collapse_all_threads();

  let curMessage = select_click_row(0);
  // First, try deleting and then cancelling at the prompt.
  Services.prefs.setBoolPref("mail.warn_on_collapsed_thread_operation", true);
  plan_for_modal_dialog("commonDialogWindow", function(controller) {
    controller.window.document
      .querySelector("dialog")
      .getButton("cancel")
      .doCommand();
  });
  // We don't use press_delete here because we're not actually deleting this
  // time!
  SimpleTest.ignoreAllUncaughtExceptions(true);
  mc.keypress(null, "VK_DELETE", {});
  SimpleTest.ignoreAllUncaughtExceptions(false);
  wait_for_modal_dialog("commonDialogWindow");
  // Make sure we didn't actually delete the message.
  Assert.equal(curMessage, select_click_row(0));

  // Second, try deleting and then accepting the deletion.
  plan_for_modal_dialog("commonDialogWindow", function(controller) {
    controller.window.document
      .querySelector("dialog")
      .getButton("accept")
      .doCommand();
  });
  press_delete(mc);
  wait_for_modal_dialog("commonDialogWindow");
  // Make sure we really did delete the message.
  Assert.notEqual(curMessage, select_click_row(0));

  // Finally, try shift-deleting when we turned off the prompt.
  Services.prefs.setBoolPref("mail.warn_on_collapsed_thread_operation", false);
  curMessage = select_click_row(0);
  press_delete(mc);
  wait_for_modal_dialog("commonDialogWindow");
  // Make sure we really did delete the message.
  Assert.notEqual(curMessage, select_click_row(0));

  Services.prefs.clearUserPref("mail.warn_on_collapsed_thread_operation");
});

add_task(function test_yearly_archive() {
  yearly_archive(false);
});

function yearly_archive(keep_structure) {
  be_in_folder(archiveSrcFolder);
  make_display_unthreaded();
  mc.folderDisplay.view.sort(
    Ci.nsMsgViewSortType.byDate,
    Ci.nsMsgViewSortOrder.ascending
  );

  let identity = MailServices.accounts.getFirstIdentityForServer(
    mc.folderDisplay.view.dbView.getMsgHdrAt(0).folder.server
  );
  identity.archiveGranularity = Ci.nsIMsgIdentity.perYearArchiveFolders;
  // We need to get all the info about the messages before we do the archive,
  // because deleting the headers could make extracting values from them fail.
  let firstMsgHdr = mc.folderDisplay.view.dbView.getMsgHdrAt(0);
  let lastMsgHdr = mc.folderDisplay.view.dbView.getMsgHdrAt(12);
  let firstMsgHdrMsgId = firstMsgHdr.messageId;
  let lastMsgHdrMsgId = lastMsgHdr.messageId;
  let firstMsgDate = new Date(firstMsgHdr.date / 1000);
  let firstMsgYear = firstMsgDate.getFullYear().toString();
  let lastMsgDate = new Date(lastMsgHdr.date / 1000);
  let lastMsgYear = lastMsgDate.getFullYear().toString();

  select_click_row(0);
  select_control_click_row(12);

  // Press the archive key. The results should go into two separate years.
  archive_selected_messages();

  // Figure out where the messages should have gone.
  let archiveRoot = "mailbox://nobody@Local%20Folders/Archives";
  let firstArchiveUri = archiveRoot + "/" + firstMsgYear;
  let lastArchiveUri = archiveRoot + "/" + lastMsgYear;
  if (keep_structure) {
    firstArchiveUri += "/ArchiveSrc";
    lastArchiveUri += "/ArchiveSrc";
  }
  let firstArchiveFolder = MailUtils.getOrCreateFolder(firstArchiveUri);
  let lastArchiveFolder = MailUtils.getOrCreateFolder(lastArchiveUri);
  be_in_folder(firstArchiveFolder);
  Assert.ok(
    mc.dbView.getMsgHdrAt(0).messageId == firstMsgHdrMsgId,
    "Message should have been archived to " +
      firstArchiveUri +
      ", but it isn't present there"
  );
  be_in_folder(lastArchiveFolder);

  Assert.ok(
    mc.dbView.getMsgHdrAt(0).messageId == lastMsgHdrMsgId,
    "Message should have been archived to " +
      lastArchiveUri +
      ", but it isn't present there"
  );
}

add_task(function test_monthly_archive() {
  enable_archiving(true);
  monthly_archive(false);
});

function monthly_archive(keep_structure) {
  be_in_folder(archiveSrcFolder);
  let identity = MailServices.accounts.getFirstIdentityForServer(
    mc.folderDisplay.view.dbView.getMsgHdrAt(0).folder.server
  );
  identity.archiveGranularity = Ci.nsIMsgIdentity.perMonthArchiveFolders;
  select_click_row(0);
  select_control_click_row(1);

  let firstMsgHdr = mc.folderDisplay.view.dbView.getMsgHdrAt(0);
  let lastMsgHdr = mc.folderDisplay.view.dbView.getMsgHdrAt(1);
  let firstMsgHdrMsgId = firstMsgHdr.messageId;
  let lastMsgHdrMsgId = lastMsgHdr.messageId;
  let firstMsgDate = new Date(firstMsgHdr.date / 1000);
  let firstMsgYear = firstMsgDate.getFullYear().toString();
  let firstMonthFolderName =
    firstMsgYear +
    "-" +
    (firstMsgDate.getMonth() + 1).toString().padStart(2, "0");
  let lastMsgDate = new Date(lastMsgHdr.date / 1000);
  let lastMsgYear = lastMsgDate.getFullYear().toString();
  let lastMonthFolderName =
    lastMsgYear +
    "-" +
    (lastMsgDate.getMonth() + 1).toString().padStart(2, "0");

  // Press the archive key. The results should go into two separate months.
  archive_selected_messages();

  // Figure out where the messages should have gone.
  let archiveRoot = "mailbox://nobody@Local%20Folders/Archives";
  let firstArchiveUri =
    archiveRoot + "/" + firstMsgYear + "/" + firstMonthFolderName;
  let lastArchiveUri =
    archiveRoot + "/" + lastMsgYear + "/" + lastMonthFolderName;
  if (keep_structure) {
    firstArchiveUri += "/ArchiveSrc";
    lastArchiveUri += "/ArchiveSrc";
  }
  let firstArchiveFolder = MailUtils.getOrCreateFolder(firstArchiveUri);
  let lastArchiveFolder = MailUtils.getOrCreateFolder(lastArchiveUri);
  be_in_folder(firstArchiveFolder);
  Assert.ok(
    mc.dbView.getMsgHdrAt(0).messageId == firstMsgHdrMsgId,
    "Message should have been archived to Local Folders/" +
      firstMsgYear +
      "/" +
      firstMonthFolderName +
      "/Archives, but it isn't present there"
  );
  be_in_folder(lastArchiveFolder);
  Assert.ok(
    mc.dbView.getMsgHdrAt(0).messageId == lastMsgHdrMsgId,
    "Message should have been archived to Local Folders/" +
      lastMsgYear +
      "/" +
      lastMonthFolderName +
      "/Archives, but it isn't present there"
  );
}

add_task(function test_folder_structure_archiving() {
  enable_archiving(true);
  Services.prefs.setBoolPref(
    "mail.identity.default.archive_keep_folder_structure",
    true
  );
  monthly_archive(true);
  yearly_archive(true);
});

add_task(function test_selection_after_archive() {
  enable_archiving(true);
  be_in_folder(archiveSrcFolder);
  let identity = MailServices.accounts.getFirstIdentityForServer(
    mc.folderDisplay.view.dbView.getMsgHdrAt(0).folder.server
  );
  identity.archiveGranularity = Ci.nsIMsgIdentity.perMonthArchiveFolders;
  // We had a bug where we would always select the 0th message after an
  // archive, so test that we'll actually select the next remaining message
  // by archiving rows 1 & 2 and verifying that the 3rd message gets selected.
  let hdrToSelect = select_click_row(3);
  select_click_row(1);
  select_control_click_row(2);
  archive_selected_messages();
  assert_selected_and_displayed(hdrToSelect);
});

add_task(function test_disabled_archive() {
  enable_archiving(false);
  be_in_folder(archiveSrcFolder);

  // test single message
  let current = select_click_row(0);
  mc.keypress(null, "a", {});
  assert_selected_and_displayed(current);

  Assert.ok(
    mc.e("hdrArchiveButton").disabled,
    "Archive button should be disabled when archiving is disabled!"
  );

  // test message summaries
  select_click_row(0);
  current = select_shift_click_row(2);
  mc.keypress(null, "a", {});
  assert_selected_and_displayed(current);

  let htmlframe = mc.e("multimessage");
  let archiveBtn = htmlframe.contentDocument.getElementById("hdrArchiveButton");
  Assert.ok(
    archiveBtn.collapsed,
    "Multi-message archive button should be disabled when " +
      "archiving is disabled!"
  );

  // test message summaries with "large" selection
  mc.folderDisplay.MAX_COUNT_FOR_CAN_ARCHIVE_CHECK = 1;
  select_click_row(0);
  current = select_shift_click_row(2);
  mc.keypress(null, "a", {});
  assert_selected_and_displayed(current);
  mc.folderDisplay.MAX_COUNT_FOR_CAN_ARCHIVE_CHECK = 100;

  htmlframe = mc.e("multimessage");
  archiveBtn = htmlframe.contentDocument.getElementById("hdrArchiveButton");
  Assert.ok(
    archiveBtn.collapsed,
    "Multi-message archive button should be disabled when " +
      "archiving is disabled!"
  );
});

function check_tag_in_message(message, tag, isSet) {
  let tagSet = message
    .getStringProperty("keywords")
    .split(" ")
    .includes(tag.key);
  if (isSet) {
    Assert.ok(tagSet, "Tag '" + tag.name + "' expected on message!");
  } else {
    Assert.ok(!tagSet, "Tag '" + tag.name + "' not expected on message!");
  }
}

add_task(function test_tag_keys() {
  be_in_folder(unreadFolder);
  let curMessage = select_click_row(0);

  mc.keypress(null, "1", {});
  check_tag_in_message(curMessage, tagArray[0], true);

  mc.keypress(null, "2", {});
  check_tag_in_message(curMessage, tagArray[0], true);
  check_tag_in_message(curMessage, tagArray[1], true);

  mc.keypress(null, "0", {});
  check_tag_in_message(curMessage, tagArray[0], false);
  check_tag_in_message(curMessage, tagArray[1], false);
});

add_task(function test_tag_keys_disabled_in_content_tab() {
  be_in_folder(unreadFolder);
  let curMessage = select_click_row(0);

  mc.window.openAddonsMgr("addons://list/theme");
  mc.sleep(0);

  let tab = mc.tabmail.currentTabInfo;
  wait_for_content_tab_load(tab, "about:addons", 15000);

  // Make sure pressing the "1" key in a content tab doesn't tag a message
  check_tag_in_message(curMessage, tagArray[0], false);
  mc.keypress(null, "1", {});
  check_tag_in_message(curMessage, tagArray[0], false);

  mc.tabmail.closeTab(tab);
});

registerCleanupFunction(function teardownModule() {
  // Make sure archiving is enabled at the end
  enable_archiving(true);
  Services.prefs.setBoolPref("mailnews.mark_message_read.auto", gAutoRead);
});
