/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var {
  be_in_folder,
  create_folder,
  make_new_sets_in_folder,
} = ChromeUtils.import(
  "resource://testing-common/mozmill/FolderDisplayHelpers.jsm"
);
var {
  plan_for_new_window,
  plan_for_window_close,
  wait_for_new_window,
  wait_for_window_close,
} = ChromeUtils.import("resource://testing-common/mozmill/WindowHelpers.jsm");

var { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { MailServices } = ChromeUtils.import(
  "resource:///modules/MailServices.jsm"
);

// Our global folder variables...
var gFolder = null;
var gFolder2 = null;

// An object to keep track of the boolean preferences we change, so that
// we can put them back.
var gOrigBoolPrefs = {};
var gTotalOpenTime;

// Used by make_gradually_newer_sets_in_folders
var gMsgMinutes = 9000;

// We'll use this mock alerts service to capture notification events
var gMockAlertsService = {
  _doFail: false,

  QueryInterface: ChromeUtils.generateQI([Ci.nsIAlertsService]),

  showAlertNotification(
    imageUrl,
    title,
    text,
    textClickable,
    cookie,
    alertListener,
    name
  ) {
    // Setting the _doFail flag allows us to revert to the newmailalert.xhtml
    // notification
    if (this._doFail) {
      SimpleTest.expectUncaughtException(true);
      throw Components.Exception("", Cr.NS_ERROR_FAILURE);
    }
    this._didNotify = true;
    this._imageUrl = imageUrl;
    this._title = title;
    this._text = text;
    this._textClickable = textClickable;
    this._cookie = cookie;
    this._alertListener = alertListener;
    this._name = name;

    this._alertListener.observe(null, "alertfinished", this._cookie);
  },

  _didNotify: false,
  _imageUrl: null,
  _title: null,
  _text: null,
  _textClickable: null,
  _cookie: null,
  _alertListener: null,
  _name: null,

  _reset() {
    // Tell any listeners that we're through
    if (this._alertListener) {
      this._alertListener.observe(null, "alertfinished", this._cookie);
    }

    this._didNotify = false;
    this._imageUrl = null;
    this._title = null;
    this._text = null;
    this._textClickable = null;
    this._cookie = null;
    this._alertListener = null;
    this._name = null;
  },
};

var gMockAlertsServiceFactory = {
  createInstance(aOuter, aIID) {
    if (aOuter != null) {
      throw Components.Exception("", Cr.NS_ERROR_NO_AGGREGATION);
    }

    if (!aIID.equals(Ci.nsIAlertsService)) {
      throw Components.Exception("", Cr.NS_ERROR_NO_INTERFACE);
    }

    return gMockAlertsService;
  },
};

add_task(function setupModule(module) {
  // Register the mock alerts service
  Components.manager
    .QueryInterface(Ci.nsIComponentRegistrar)
    .registerFactory(
      Components.ID("{1bda6c33-b089-43df-a8fd-111907d6385a}"),
      "Mock Alerts Service",
      "@mozilla.org/system-alerts-service;1",
      gMockAlertsServiceFactory
    );

  // Ensure we have enabled new mail notifications
  remember_and_set_bool_pref("mail.biff.show_alert", true);

  // Ensure that system notifications are used (relevant for Linux only)
  if (
    Services.appinfo.OS == "Linux" ||
    "@mozilla.org/gio-service;1" in Cc ||
    "@mozilla.org/gnome-gconf-service;1" in Cc
  ) {
    remember_and_set_bool_pref("mail.biff.use_system_alert", true);
  }

  MailServices.accounts.localFoldersServer.performingBiff = true;

  // Create a second identity to check cross-account
  // notifications.
  var identity2 = MailServices.accounts.createIdentity();
  identity2.email = "new-account@foo.invalid";

  var server = MailServices.accounts.createIncomingServer(
    "nobody",
    "Test Local Folders",
    "pop3"
  );

  server.performingBiff = true;

  // Create the target folders
  gFolder = create_folder("My Folder");
  let localRoot = server.rootFolder.QueryInterface(Ci.nsIMsgLocalMailFolder);
  gFolder2 = localRoot.createLocalSubfolder("Another Folder");

  var account = MailServices.accounts.createAccount();
  account.incomingServer = server;
  account.addIdentity(identity2);
});

registerCleanupFunction(function teardownModule(module) {
  put_bool_prefs_back();
  if (Services.appinfo.OS != "Darwin") {
    Services.prefs.setIntPref("alerts.totalOpenTime", gTotalOpenTime);
  }
});

function setupTest(test) {
  gFolder.markAllMessagesRead(null);
  gMockAlertsService._reset();
  gMockAlertsService._doFail = false;
  gFolder.biffState = Ci.nsIMsgFolder.nsMsgBiffState_NoMail;
  gFolder2.biffState = Ci.nsIMsgFolder.nsMsgBiffState_NoMail;

  remember_and_set_bool_pref("mail.biff.alert.show_subject", true);
  remember_and_set_bool_pref("mail.biff.alert.show_sender", true);
  remember_and_set_bool_pref("mail.biff.alert.show_preview", true);
  if (Services.appinfo.OS != "Darwin") {
    gTotalOpenTime = Services.prefs.getIntPref("alerts.totalOpenTime");
    Services.prefs.setIntPref("alerts.totalOpenTime", 3000);
  }
}

function put_bool_prefs_back() {
  for (let prefString in gOrigBoolPrefs) {
    Services.prefs.setBoolPref(prefString, gOrigBoolPrefs[prefString]);
  }
}

function remember_and_set_bool_pref(aPrefString, aBoolValue) {
  if (!gOrigBoolPrefs[aPrefString]) {
    gOrigBoolPrefs[aPrefString] = Services.prefs.getBoolPref(aPrefString);
  }

  Services.prefs.setBoolPref(aPrefString, aBoolValue);
}

/* This function wraps up make_new_sets_in_folder, and takes the
 * same arguments.  The point of this function is to ensure that
 * each sent message is slightly newer than the last.  In this
 * case, each new message set will be sent one minute further
 * into the future than the last message set.
 */
function make_gradually_newer_sets_in_folder(aFolder, aArgs) {
  gMsgMinutes -= 1;
  if (!aArgs.age) {
    for (let arg of aArgs) {
      arg.age = { minutes: gMsgMinutes };
    }
  }
  make_new_sets_in_folder(aFolder, aArgs);
}

/**
 * Test that we revert to newmailalert.xhtml if there is no system
 * notification service present.
 */
add_task(function test_revert_to_newmailalert() {
  setupTest();
  // Set up the gMockAlertsService so that it fails
  // to send a notification.
  gMockAlertsService._doFail = true;

  // We expect the newmailalert.xhtml window...
  plan_for_new_window("alert:alert");
  make_gradually_newer_sets_in_folder(gFolder, [{ count: 2 }]);
  let controller = wait_for_new_window("alert:alert");
  plan_for_window_close(controller);
  wait_for_window_close();
});

/**
 * Test that receiving new mail causes a notification to appear
 */
add_task(function test_new_mail_received_causes_notification() {
  setupTest();
  make_gradually_newer_sets_in_folder(gFolder, [{ count: 1 }]);
  Assert.ok(gMockAlertsService._didNotify, "Did not show alert notification.");
});

/**
 * Test that if notification shows, we don't show newmailalert.xhtml
 */
add_task(function test_dont_show_newmailalert() {
  setupTest();
  make_gradually_newer_sets_in_folder(gFolder, [{ count: 1 }]);

  // Wait for newmailalert.xhtml to show
  plan_for_new_window("alert:alert");
  try {
    wait_for_new_window("alert:alert");
    throw Error("Opened newmailalert.xhtml when we shouldn't have.");
  } catch (e) {
    // Correct behaviour - the window didn't show.
  }
});

/**
 * Test that we notify, showing the oldest new, unread message received
 * since the last notification.
 */
add_task(function test_show_oldest_new_unread_since_last_notification() {
  setupTest();
  let notifyFirst = "This should notify first";
  Assert.ok(!gMockAlertsService._didNotify, "Should not have notified yet.");
  make_gradually_newer_sets_in_folder(gFolder, [
    { count: 1, body: { body: notifyFirst } },
  ]);
  Assert.ok(gMockAlertsService._didNotify, "Should have notified.");
  Assert.ok(
    gMockAlertsService._text.includes(notifyFirst, 1),
    "Should have notified for the first message"
  );

  be_in_folder(gFolder);
  gFolder.biffState = Ci.nsIMsgFolder.nsMsgBiffState_NoMail;
  gMockAlertsService._reset();

  let notifySecond = "This should notify second";
  Assert.ok(!gMockAlertsService._didNotify, "Should not have notified yet.");
  make_gradually_newer_sets_in_folder(gFolder, [
    { count: 1, body: { body: notifySecond } },
  ]);
  Assert.ok(gMockAlertsService._didNotify, "Should have notified.");
  Assert.ok(
    gMockAlertsService._text.includes(notifySecond, 1),
    "Should have notified for the second message"
  );
});

/**
 * Test that notifications work across different accounts.
 */
add_task(function test_notification_works_across_accounts() {
  setupTest();
  // Cause a notification in the first folder
  make_gradually_newer_sets_in_folder(gFolder, [{ count: 1 }]);
  Assert.ok(gMockAlertsService._didNotify, "Should have notified.");

  gMockAlertsService._reset();
  // We'll set the time for these messages to be slightly further
  // into the past.  That way, test_notification_independent_across_accounts
  // has an opportunity to send slightly newer messages that are older than
  // the messages sent to gFolder.
  make_gradually_newer_sets_in_folder(gFolder2, [
    { count: 2, age: { minutes: gMsgMinutes + 20 } },
  ]);
  Assert.ok(gMockAlertsService._didNotify, "Should have notified.");
});

/* Test that notification timestamps are independent from account
 * to account.  This is for the scenario where we have two accounts, and
 * one has notified while the other is still updating.  When the second
 * account completes, if it has new mail, it should notify, even if second
 * account's newest mail is older than the first account's newest mail.
 */
add_task(function test_notifications_independent_across_accounts() {
  setupTest();
  make_gradually_newer_sets_in_folder(gFolder, [{ count: 1 }]);
  Assert.ok(gMockAlertsService._didNotify, "Should have notified.");

  gMockAlertsService._reset();
  // Next, let's make some mail arrive in the second folder, but
  // let's have that mail be slightly older than the mail that
  // landed in the first folder.  We should still notify.
  make_gradually_newer_sets_in_folder(gFolder2, [
    { count: 2, age: { minutes: gMsgMinutes + 10 } },
  ]);
  Assert.ok(gMockAlertsService._didNotify, "Should have notified.");
});

/**
 * Test that we can show the message subject in the notification.
 */
add_task(function test_show_subject() {
  setupTest();
  let subject = "This should be displayed";
  make_gradually_newer_sets_in_folder(gFolder, [{ count: 1, subject }]);
  Assert.ok(gMockAlertsService._didNotify, "Should have notified");
  Assert.ok(
    gMockAlertsService._text.includes(subject),
    "Should have displayed the subject"
  );
});

/**
 * Test that we can hide the message subject in the notification.
 */
add_task(function test_hide_subject() {
  setupTest();
  Services.prefs.setBoolPref("mail.biff.alert.show_subject", false);
  let subject = "This should not be displayed";
  make_gradually_newer_sets_in_folder(gFolder, [{ count: 1, subject }]);
  Assert.ok(gMockAlertsService._didNotify, "Should have notified");
  Assert.ok(
    !gMockAlertsService._text.includes(subject),
    "Should not have displayed the subject"
  );
});

/**
 * Test that we can show just the message sender in the notification.
 */
add_task(function test_show_only_subject() {
  setupTest();
  Services.prefs.setBoolPref("mail.biff.alert.show_preview", false);
  Services.prefs.setBoolPref("mail.biff.alert.show_sender", false);
  Services.prefs.setBoolPref("mail.biff.alert.show_subject", true);

  let sender = ["John Cleese", "john@cleese.invalid"];
  let subject = "This should not be displayed";
  let messageBody = "My message preview";

  make_gradually_newer_sets_in_folder(gFolder, [
    { count: 1, from: sender, subject, body: { body: messageBody } },
  ]);
  Assert.ok(gMockAlertsService._didNotify, "Should have notified");
  Assert.ok(
    gMockAlertsService._text.includes(subject),
    "Should have displayed the subject"
  );
  Assert.ok(
    !gMockAlertsService._text.includes(messageBody),
    "Should not have displayed the preview"
  );
  Assert.ok(
    !gMockAlertsService._text.includes(sender[0]),
    "Should not have displayed the sender"
  );
});

/**
 * Test that we can show the message sender in the notification.
 */
add_task(function test_show_sender() {
  setupTest();
  let sender = ["John Cleese", "john@cleese.invalid"];
  make_gradually_newer_sets_in_folder(gFolder, [{ count: 1, from: sender }]);
  Assert.ok(gMockAlertsService._didNotify, "Should have notified");
  Assert.ok(
    gMockAlertsService._text.includes(sender[0]),
    "Should have displayed the sender"
  );
});

/**
 * Test that we can hide the message sender in the notification.
 */
add_task(function test_hide_sender() {
  setupTest();
  Services.prefs.setBoolPref("mail.biff.alert.show_sender", false);
  let sender = ["John Cleese", "john@cleese.invalid"];
  make_gradually_newer_sets_in_folder(gFolder, [{ count: 1, from: sender }]);
  Assert.ok(gMockAlertsService._didNotify, "Should have notified");
  Assert.ok(
    !gMockAlertsService._text.includes(sender[0]),
    "Should not have displayed the sender"
  );
});

/**
 * Test that we can show just the message sender in the notification.
 */
add_task(function test_show_only_sender() {
  setupTest();
  Services.prefs.setBoolPref("mail.biff.alert.show_preview", false);
  Services.prefs.setBoolPref("mail.biff.alert.show_sender", true);
  Services.prefs.setBoolPref("mail.biff.alert.show_subject", false);

  let sender = ["John Cleese", "john@cleese.invalid"];
  let subject = "This should not be displayed";
  let messageBody = "My message preview";

  make_gradually_newer_sets_in_folder(gFolder, [
    { count: 1, from: sender, subject, body: { body: messageBody } },
  ]);
  Assert.ok(gMockAlertsService._didNotify, "Should have notified");
  Assert.ok(
    gMockAlertsService._text.includes(sender[0]),
    "Should have displayed the sender"
  );
  Assert.ok(
    !gMockAlertsService._text.includes(messageBody),
    "Should not have displayed the preview"
  );
  Assert.ok(
    !gMockAlertsService._text.includes(subject),
    "Should not have displayed the subject"
  );
});

/**
 * Test that we can show the message preview in the notification.
 */
add_task(function test_show_preview() {
  setupTest();
  Services.prefs.setBoolPref("mail.biff.alert.show_preview", true);
  let messageBody = "My message preview";
  make_gradually_newer_sets_in_folder(gFolder, [
    { count: 1, body: { body: messageBody } },
  ]);
  Assert.ok(gMockAlertsService._didNotify, "Should have notified");
  Assert.ok(
    gMockAlertsService._text.includes(messageBody),
    "Should have displayed the preview"
  );
});

/**
 * Test that we can hide the message preview in the notification.
 */
add_task(function test_hide_preview() {
  setupTest();
  Services.prefs.setBoolPref("mail.biff.alert.show_preview", false);
  let messageBody = "My message preview";
  make_gradually_newer_sets_in_folder(gFolder, [
    { count: 1, body: { body: messageBody } },
  ]);
  Assert.ok(gMockAlertsService._didNotify, "Should have notified");
  Assert.ok(
    !gMockAlertsService._text.includes(messageBody),
    "Should not have displayed the preview"
  );
});

/**
 * Test that we can show justthe message preview in the notification.
 */
add_task(function test_show_only_preview() {
  setupTest();
  Services.prefs.setBoolPref("mail.biff.alert.show_preview", true);
  Services.prefs.setBoolPref("mail.biff.alert.show_sender", false);
  Services.prefs.setBoolPref("mail.biff.alert.show_subject", false);

  let sender = ["John Cleese", "john@cleese.invalid"];
  let subject = "This should not be displayed";
  let messageBody = "My message preview";
  make_gradually_newer_sets_in_folder(gFolder, [
    { count: 1, from: sender, subject, body: { body: messageBody } },
  ]);
  Assert.ok(gMockAlertsService._didNotify, "Should have notified");
  Assert.ok(
    gMockAlertsService._text.includes(messageBody),
    "Should have displayed the preview: " + gMockAlertsService._text
  );
  Assert.ok(
    !gMockAlertsService._text.includes(sender[0]),
    "Should not have displayed the sender"
  );
  Assert.ok(
    !gMockAlertsService._text.includes(subject),
    "Should not have displayed the subject"
  );
});

/**
 * Test that we can receive notifications even when the biff state of
 * the folder has not been changed.
 */
add_task(function test_still_notify_with_unchanged_biff() {
  setupTest();
  // For now, we'll make sure that if we receive 10 pieces
  // of email, one after the other, we'll be notified for all
  // (assuming of course that the notifications have a chance
  // to close in between arrivals - we don't want a queue of
  // notifications to go through).
  const HOW_MUCH_MAIL = 10;

  Assert.ok(!gMockAlertsService._didNotify, "Should have notified.");

  for (let i = 0; i < HOW_MUCH_MAIL; i++) {
    make_gradually_newer_sets_in_folder(gFolder, [{ count: 1 }]);
    Assert.ok(gMockAlertsService._didNotify, "Should have notified.");
    gMockAlertsService._reset();
  }
});

/**
 * Test that we don't receive notifications for Draft, Queue, SentMail,
 * Templates or Junk folders.
 */
add_task(function test_no_notification_for_uninteresting_folders() {
  setupTest();
  var someFolder = create_folder("Uninteresting Folder");
  var uninterestingFlags = [
    Ci.nsMsgFolderFlags.Drafts,
    Ci.nsMsgFolderFlags.Queue,
    Ci.nsMsgFolderFlags.SentMail,
    Ci.nsMsgFolderFlags.Templates,
    Ci.nsMsgFolderFlags.Junk,
    Ci.nsMsgFolderFlags.Archive,
  ];

  for (let i = 0; i < uninterestingFlags.length; i++) {
    someFolder.flags = uninterestingFlags[i];
    make_gradually_newer_sets_in_folder(someFolder, [{ count: 1 }]);
    Assert.ok(!gMockAlertsService._didNotify, "Showed alert notification.");
  }

  // However, we want to ensure that Inboxes *always* notify, even
  // if they possess the flags we consider uninteresting.
  someFolder.flags = Ci.nsMsgFolderFlags.Inbox;

  for (let i = 0; i < uninterestingFlags.length; i++) {
    someFolder.flags |= uninterestingFlags[i];
    make_gradually_newer_sets_in_folder(someFolder, [{ count: 1 }]);
    Assert.ok(
      gMockAlertsService._didNotify,
      "Did not show alert notification."
    );
    someFolder.flags = someFolder.flags & ~uninterestingFlags[i];
  }
});
