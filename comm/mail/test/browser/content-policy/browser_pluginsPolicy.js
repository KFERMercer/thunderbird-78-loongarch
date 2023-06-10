/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Checks if plugins are enabled in messages correctly or not.
 * As of bug 1508942, plugins are no longer enabled in any context.
 */

"use strict";

var mozmill = ChromeUtils.import(
  "resource://testing-common/mozmill/mozmill.jsm"
);

var composeHelper = ChromeUtils.import(
  "resource://testing-common/mozmill/ComposeHelpers.jsm"
);
var { open_content_tab_with_url } = ChromeUtils.import(
  "resource://testing-common/mozmill/ContentTabHelpers.jsm"
);

var {
  assert_nothing_selected,
  assert_selected_and_displayed,
  be_in_folder,
  close_message_window,
  create_folder,
  mc,
  open_selected_message,
  select_click_row,
  select_none,
  set_open_message_behavior,
  wait_for_message_display_completion,
} = ChromeUtils.import(
  "resource://testing-common/mozmill/FolderDisplayHelpers.jsm"
);
var { plan_for_new_window, wait_for_new_window } = ChromeUtils.import(
  "resource://testing-common/mozmill/WindowHelpers.jsm"
);

var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

var folder = null;
var gMsgNo = 0;

var url =
  "http://mochi.test:8888/browser/comm/mail/test/browser/content-policy/html/";

// These two constants are used to build the message body.
var msgBody =
  '<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN">\n' +
  "<html>\n" +
  "<head>\n" +
  "\n" +
  '<meta http-equiv="content-type" content="text/html; charset=ISO-8859-1">\n' +
  "</head>\n" +
  '<body bgcolor="#ffffff" text="#000000">\n' +
  '<embed id="testelement" type="application/x-test" width="400" height="400" border="1"></embed>\n' +
  "</body>\n</html>\n";

add_task(function setupModule(module) {
  folder = create_folder("pluginPolicy");
});

function addToFolder(aSubject, aBody, aFolder) {
  let msgId =
    Cc["@mozilla.org/uuid-generator;1"]
      .getService(Ci.nsIUUIDGenerator)
      .generateUUID() + "@mozillamessaging.invalid";

  let source =
    "From - Sat Nov  1 12:39:54 2008\n" +
    "X-Mozilla-Status: 0001\n" +
    "X-Mozilla-Status2: 00000000\n" +
    "Message-ID: <" +
    msgId +
    ">\n" +
    "Date: Wed, 11 Jun 2008 20:32:02 -0400\n" +
    "From: Tester <tests@mozillamessaging.invalid>\n" +
    "User-Agent: Thunderbird 3.0a2pre (Macintosh/2008052122)\n" +
    "MIME-Version: 1.0\n" +
    "To: recipient@mozillamessaging.invalid\n" +
    "Subject: " +
    aSubject +
    "\n" +
    "Content-Type: text/html; charset=ISO-8859-1\n" +
    "Content-Transfer-Encoding: 7bit\n" +
    "\n" +
    aBody +
    "\n";

  aFolder.QueryInterface(Ci.nsIMsgLocalMailFolder);
  aFolder.gettingNewMessages = true;

  aFolder.addMessage(source);
  aFolder.gettingNewMessages = false;

  return aFolder.msgDatabase.getMsgHdrForMessageID(msgId);
}

function isPluginLoaded(contentDocument) {
  let element = contentDocument.getElementById("testelement").wrappedJSObject;

  try {
    // if setColor throws, then the plugin isn't running
    element.setColor("FFFF0000");
    return true;
  } catch (ex) {
    // Any errors and we'll just return false below - they may be expected.
  }
  return false;
}

function addMsgToFolderAndCheckContent(loadAllowed) {
  let msgDbHdr = addToFolder("Plugin test message " + gMsgNo, msgBody, folder);

  // select the newly created message
  let msgHdr = select_click_row(gMsgNo);

  if (msgDbHdr != msgHdr) {
    throw new Error(
      "Selected Message Header is not the same as generated header"
    );
  }

  assert_selected_and_displayed(gMsgNo);

  ++gMsgNo;

  // XXX It appears the assert_selected_and_displayed doesn't actually wait
  // long enough for plugin load. However, I also can't find a way to wait for
  // long enough in all situations, so this will have to do for now.
  mc.sleep(1000);

  // Now check that the content hasn't been loaded
  if (
    isPluginLoaded(mozmill.getMail3PaneController().window.content.document) !=
    loadAllowed
  ) {
    throw new Error(
      loadAllowed
        ? "Plugin has been unexpectedly blocked in message content"
        : "Plugin has not been blocked in message as expected"
    );
  }
}

function checkStandaloneMessageWindow(loadAllowed) {
  plan_for_new_window("mail:messageWindow");
  // Open it
  set_open_message_behavior("NEW_WINDOW");

  open_selected_message();
  let msgc = wait_for_new_window("mail:messageWindow");
  wait_for_message_display_completion(msgc, true);

  // XXX It appears the wait_for_message_display_completion doesn't actually
  // wait long enough for plugin load. However, I also can't find a way to wait
  // for long enough in all situations, so this will have to do for now.
  mc.sleep(1000);

  if (isPluginLoaded(msgc.window.content.document) != loadAllowed) {
    throw new Error(
      loadAllowed
        ? "Plugin has been unexpectedly blocked in standalone window"
        : "Plugin has not been blocked in standalone window as expected"
    );
  }

  // Clean up, close the window
  close_message_window(msgc);
}

add_task(function test_3paneWindowDenied() {
  be_in_folder(folder);

  assert_nothing_selected();

  addMsgToFolderAndCheckContent(false);
});

add_task(function test_checkPluginsInNonMessageContent() {
  // Deselect everything so we can load our content
  select_none();

  // load something non-message-like in the message pane
  mozmill.getMail3PaneController().window.GetMessagePaneFrame().location.href =
    url + "plugin.html";

  wait_for_message_display_completion();

  if (
    isPluginLoaded(mozmill.getMail3PaneController().window.content.document)
  ) {
    throw new Error(
      "Plugin is turned on in content in message pane - it should not be."
    );
  }
});

add_task(function test_3paneWindowDeniedAgain() {
  select_click_row(0);

  assert_selected_and_displayed(0);

  // Now check that the content hasn't been loaded
  if (
    isPluginLoaded(mozmill.getMail3PaneController().window.content.document)
  ) {
    throw new Error("Plugin has not been blocked in message as expected");
  }
});

add_task(function test_checkStandaloneMessageWindowDenied() {
  checkStandaloneMessageWindow(false);
});

add_task(function test_checkContentTab() {
  // To open a tab we're going to have to cheat and use tabmail so we can load
  // in the data of what we want.
  let preCount = mc.tabmail.tabContainer.allTabs.length;

  let newTab = open_content_tab_with_url(url + "plugin.html");

  if (isPluginLoaded(mc.tabmail.getBrowserForSelectedTab().contentDocument)) {
    throw new Error("Plugin has been unexpectedly not blocked in content tab");
  }

  mc.tabmail.closeTab(newTab);

  if (mc.tabmail.tabContainer.allTabs.length != preCount) {
    throw new Error("The content tab didn't close");
  }

  Assert.report(
    false,
    undefined,
    undefined,
    "Test ran to completion successfully"
  );
});
