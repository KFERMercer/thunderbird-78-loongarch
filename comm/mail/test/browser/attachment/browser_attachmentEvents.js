/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Ensures that attachment events are fired properly
 */

/* globals gFolderTreeView */

"use strict";

var { select_attachments } = ChromeUtils.import(
  "resource://testing-common/mozmill/AttachmentHelpers.jsm"
);
var { mc } = ChromeUtils.import(
  "resource://testing-common/mozmill/FolderDisplayHelpers.jsm"
);
var {
  add_attachments,
  close_compose_window,
  open_compose_new_mail,
} = ChromeUtils.import("resource://testing-common/mozmill/ComposeHelpers.jsm");
var { gMockPromptService } = ChromeUtils.import(
  "resource://testing-common/mozmill/PromptHelpers.jsm"
);

var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { fixIterator } = ChromeUtils.import(
  "resource:///modules/iteratorUtils.jsm"
);

var kAttachmentsAdded = "attachments-added";
var kAttachmentsRemoved = "attachments-removed";
var kAttachmentRenamed = "attachment-renamed";

/**
 * Test that the attachments-added event is fired when we add a single
 * attachment.
 */
add_task(function test_attachments_added_on_single() {
  gFolderTreeView.selectFolder(gFolderTreeView._enumerateFolders[1]);

  // Prepare to listen for attachments-added
  let eventCount = 0;
  let lastEvent;
  let listener = function(event) {
    eventCount++;
    lastEvent = event;
  };

  // Open up the compose window
  let cw = open_compose_new_mail(mc);
  cw.e("attachmentBucket").addEventListener(kAttachmentsAdded, listener);

  // Attach a single file
  add_attachments(cw, "http://www.example.com/1", 0, false);

  // Make sure we only saw the event once
  Assert.equal(1, eventCount);

  // Make sure that we were passed the right subject
  let subjects = lastEvent.detail;
  Assert.ok(subjects instanceof Ci.nsIMutableArray);
  Assert.equal(
    "http://www.example.com/1",
    subjects.queryElementAt(0, Ci.nsIMsgAttachment).url
  );

  // Make sure that we can get that event again if we
  // attach more files.
  add_attachments(cw, "http://www.example.com/2", 0, false);
  Assert.equal(2, eventCount);
  subjects = lastEvent.detail;
  Assert.ok(subjects instanceof Ci.nsIMutableArray);
  Assert.equal(
    "http://www.example.com/2",
    subjects.queryElementAt(0, Ci.nsIMsgAttachment).url
  );

  // And check that we don't receive the event if we try to attach a file
  // that's already attached.
  add_attachments(cw, "http://www.example.com/2", null, false);
  Assert.equal(2, eventCount);

  cw.e("attachmentBucket").removeEventListener(kAttachmentsAdded, listener);
  close_compose_window(cw);
});

/**
 * Test that the attachments-added event is fired when we add a series
 * of files all at once.
 */
add_task(function test_attachments_added_on_multiple() {
  // Prepare to listen for attachments-added
  let eventCount = 0;
  let lastEvent;
  let listener = function(event) {
    eventCount++;
    lastEvent = event;
  };

  // Prepare the attachments - we store the names in attachmentNames to
  // make sure that we observed the right event subjects later on.
  let attachmentUrls = ["http://www.example.com/1", "http://www.example.com/2"];

  // Open the compose window and add the attachments
  let cw = open_compose_new_mail(mc);
  cw.e("attachmentBucket").addEventListener(kAttachmentsAdded, listener);

  add_attachments(cw, attachmentUrls, null, false);

  // Make sure we only saw a single attachments-added for this group
  // of files.
  Assert.equal(1, eventCount);

  // Now make sure we got passed the right subjects for the event
  let subjects = lastEvent.detail;
  Assert.ok(subjects instanceof Ci.nsIMutableArray);
  Assert.equal(2, subjects.length);

  for (let attachment of fixIterator(subjects, Ci.nsIMsgAttachment)) {
    Assert.ok(attachmentUrls.includes(attachment.url));
  }

  // Close the compose window - let's try again with 3 attachments.
  cw.e("attachmentBucket").removeEventListener(kAttachmentsAdded, listener);
  close_compose_window(cw);

  attachmentUrls = [
    "http://www.example.com/1",
    "http://www.example.com/2",
    "http://www.example.com/3",
  ];

  // Open the compose window and attach the files, and ensure that we saw
  // the attachments-added event
  cw = open_compose_new_mail(mc);
  cw.e("attachmentBucket").addEventListener(kAttachmentsAdded, listener);

  add_attachments(cw, attachmentUrls, null, false);
  Assert.equal(2, eventCount);

  // Make sure that we got the right subjects back
  subjects = lastEvent.detail;
  Assert.ok(subjects instanceof Ci.nsIMutableArray);
  Assert.equal(3, subjects.length);

  for (let attachment of fixIterator(subjects, Ci.nsIMsgAttachment)) {
    Assert.ok(attachmentUrls.includes(attachment.url));
  }

  // Make sure we don't fire the event again if we try to attach the same
  // files.
  add_attachments(cw, attachmentUrls, null, false);
  Assert.equal(2, eventCount);

  cw.e("attachmentBucket").removeEventListener(kAttachmentsAdded, listener);
  close_compose_window(cw);
});

/**
 * Test that the attachments-removed event is fired when removing a
 * single file.
 */
add_task(function test_attachments_removed_on_single() {
  // Prepare to listen for attachments-removed
  let eventCount = 0;
  let lastEvent;
  let listener = function(event) {
    eventCount++;
    lastEvent = event;
  };

  // Open up the compose window, attach a file...
  let cw = open_compose_new_mail(mc);
  cw.e("attachmentBucket").addEventListener(kAttachmentsRemoved, listener);

  add_attachments(cw, "http://www.example.com/1");

  // Now select that attachment and delete it
  select_attachments(cw, 0);
  // We need to hold a reference to removedAttachment here because
  // the delete routine nulls it out from the attachmentitem.
  cw.window.goDoCommand("cmd_delete");
  // Make sure we saw the event
  Assert.equal(1, eventCount);
  // And make sure we were passed the right attachment item as the
  // subject.
  let subjects = lastEvent.detail;
  Assert.ok(subjects instanceof Ci.nsIMutableArray);
  Assert.equal(1, subjects.length);
  Assert.equal(
    subjects.queryElementAt(0, Ci.nsIMsgAttachment).url,
    "http://www.example.com/1"
  );

  // Ok, let's attach it again, and remove it again to ensure that
  // we still see the event.
  add_attachments(cw, "http://www.example.com/2");
  select_attachments(cw, 0);
  cw.window.goDoCommand("cmd_delete");

  Assert.equal(2, eventCount);
  subjects = lastEvent.detail;
  Assert.ok(subjects instanceof Ci.nsIMutableArray);
  Assert.equal(1, subjects.length);
  Assert.equal(
    subjects.queryElementAt(0, Ci.nsIMsgAttachment).url,
    "http://www.example.com/2"
  );

  cw.e("attachmentBucket").removeEventListener(kAttachmentsRemoved, listener);
  close_compose_window(cw);
});

/**
 * Test that the attachments-removed event is fired when removing multiple
 * files all at once.
 */
add_task(function test_attachments_removed_on_multiple() {
  // Prepare to listen for attachments-removed
  let eventCount = 0;
  let lastEvent;
  let listener = function(event) {
    eventCount++;
    lastEvent = event;
  };

  // Open up the compose window and attach some files...
  let cw = open_compose_new_mail(mc);
  cw.e("attachmentBucket").addEventListener(kAttachmentsRemoved, listener);

  add_attachments(cw, [
    "http://www.example.com/1",
    "http://www.example.com/2",
    "http://www.example.com/3",
  ]);

  // Select all three attachments, and remove them.
  let removedAttachmentItems = select_attachments(cw, 0, 2);

  let removedAttachmentUrls = removedAttachmentItems.map(
    aAttachment => aAttachment.attachment.url
  );

  cw.window.goDoCommand("cmd_delete");

  // We should have seen the attachments-removed event exactly once.
  Assert.equal(1, eventCount);

  // Now let's make sure we got passed back the right attachment items
  // as the event subject
  let subjects = lastEvent.detail;
  Assert.ok(subjects instanceof Ci.nsIMutableArray);
  Assert.equal(3, subjects.length);

  for (let attachment of fixIterator(subjects, Ci.nsIMsgAttachment)) {
    Assert.ok(removedAttachmentUrls.includes(attachment.url));
  }

  // Ok, let's attach and remove some again to ensure that we still see the event.
  add_attachments(cw, ["http://www.example.com/1", "http://www.example.com/2"]);

  select_attachments(cw, 0, 1);
  cw.window.goDoCommand("cmd_delete");
  Assert.equal(2, eventCount);

  cw.e("attachmentBucket").removeEventListener(kAttachmentsRemoved, listener);
  close_compose_window(cw);
});

/**
 * Test that we don't see the attachments-removed event if no attachments
 * are selected when hitting "Delete"
 */
add_task(function test_no_attachments_removed_on_none() {
  // Prepare to listen for attachments-removed
  let eventCount = 0;
  let listener = function(event) {
    eventCount++;
  };

  // Open the compose window and add some attachments.
  let cw = open_compose_new_mail(mc);
  cw.e("attachmentBucket").addEventListener(kAttachmentsRemoved, listener);

  add_attachments(cw, [
    "http://www.example.com/1",
    "http://www.example.com/2",
    "http://www.example.com/3",
  ]);

  // Choose no attachments
  cw.e("attachmentBucket").clearSelection();
  // Run the delete command
  cw.window.goDoCommand("cmd_delete");
  // Make sure we didn't see the attachments_removed event.
  Assert.equal(0, eventCount);
  cw.e("attachmentBucket").removeEventListener(kAttachmentsRemoved, listener);

  close_compose_window(cw);
});

/**
 * Test that we see the attachment-renamed event when an attachments
 * name is changed.
 */
add_task(function test_attachment_renamed() {
  // Here's what we'll rename some files to.
  const kRenameTo1 = "Renamed-1";
  const kRenameTo2 = "Renamed-2";
  const kRenameTo3 = "Renamed-3";

  // Prepare to listen for attachment-renamed
  let eventCount = 0;
  let lastEvent;
  let listener = function(event) {
    eventCount++;
    lastEvent = event;
  };

  // Renaming a file brings up a Prompt, so we'll mock the Prompt Service
  gMockPromptService.reset();
  gMockPromptService.register();
  // The inoutValue is used to set the attachment name
  gMockPromptService.inoutValue = kRenameTo1;
  gMockPromptService.returnValue = true;

  // Open up the compose window, attach some files, choose the first
  // attachment, and choose to rename it.
  let cw = open_compose_new_mail(mc);
  cw.e("attachmentBucket").addEventListener(kAttachmentRenamed, listener);

  add_attachments(cw, [
    "http://www.example.com/1",
    "http://www.example.com/2",
    "http://www.example.com/3",
  ]);

  select_attachments(cw, 0);
  cw.window.goDoCommand("cmd_renameAttachment");

  // Ensure that we saw the attachment-renamed event
  Assert.equal(1, eventCount);
  // Ensure that the event mentions the right attachment
  let renamedAttachment1 = lastEvent.target.attachment;
  let originalName1 = lastEvent.detail;
  Assert.ok(renamedAttachment1 instanceof Ci.nsIMsgAttachment);
  Assert.equal(kRenameTo1, renamedAttachment1.name);
  Assert.ok(renamedAttachment1.url.includes("http://www.example.com/1"));
  Assert.equal("www.example.com/1", originalName1);

  // Ok, let's try renaming the same attachment.
  gMockPromptService.reset();
  gMockPromptService.inoutValue = kRenameTo2;
  gMockPromptService.returnValue = true;

  select_attachments(cw, 0);
  cw.window.goDoCommand("cmd_renameAttachment");

  Assert.equal(2, eventCount);
  let renamedAttachment2 = lastEvent.target.attachment;
  let originalName2 = lastEvent.detail;
  Assert.ok(renamedAttachment2 instanceof Ci.nsIMsgAttachment);
  Assert.equal(kRenameTo2, renamedAttachment2.name);
  Assert.ok(renamedAttachment2.url.includes("http://www.example.com/1"));
  Assert.equal(kRenameTo1, originalName2);

  // Ok, let's rename another attachment
  gMockPromptService.reset();
  gMockPromptService.inoutValue = kRenameTo3;
  gMockPromptService.returnValue = true;

  // We'll select the second attachment this time.
  select_attachments(cw, 1);
  cw.window.goDoCommand("cmd_renameAttachment");

  // Ensure we saw the attachment-renamed event
  Assert.equal(3, eventCount);
  // Ensure that the event mentions the right attachment
  let renamedAttachment3 = lastEvent.target.attachment;
  let originalName3 = lastEvent.detail;
  Assert.ok(renamedAttachment3 instanceof Ci.nsIMsgAttachment);
  Assert.equal(kRenameTo3, renamedAttachment3.name);
  Assert.ok(renamedAttachment3.url.includes("http://www.example.com/2"));
  Assert.equal("www.example.com/2", originalName3);

  // Unregister the Mock Prompt service, and remove our observer.
  cw.e("attachmentBucket").removeEventListener(kAttachmentRenamed, listener);

  close_compose_window(cw);
  gMockPromptService.unregister();
});

/**
 * Test that the attachment-renamed event is not fired if we set the
 * filename to be blank.
 */
add_task(function test_no_attachment_renamed_on_blank() {
  // Prepare to listen for attachment-renamed
  let eventCount = 0;
  let listener = function(event) {
    eventCount++;
  };

  // Register the Mock Prompt Service to return the empty string when
  // prompted.
  gMockPromptService.reset();
  gMockPromptService.register();
  gMockPromptService.inoutValue = "";
  gMockPromptService.returnValue = true;

  // Open the compose window, attach some files, select one, and chooes to
  // rename it.
  let cw = open_compose_new_mail(mc);
  cw.e("attachmentBucket").addEventListener(kAttachmentRenamed, listener);

  add_attachments(cw, [
    "http://www.example.com/1",
    "http://www.example.com/2",
    "http://www.example.com/3",
  ]);

  select_attachments(cw, 0);
  cw.window.goDoCommand("cmd_renameAttachment");

  // Ensure that we didn't see the attachment-renamed event.
  Assert.equal(0, eventCount);
  cw.e("attachmentBucket").removeEventListener(kAttachmentRenamed, listener);
  close_compose_window(cw);
  gMockPromptService.unregister();
});

/**
 * Test that toggling attachments pane works.
 */
add_task(function test_attachments_pane_toggle() {
  // Open the compose window.
  let cw = open_compose_new_mail(mc);

  // Use the hotkey to toggle attachments-box open.

  cw.keypress(
    null,
    "m",
    AppConstants.platform == "macosx" ? { ctrlKey: true } : { altKey: true }
  );
  let attachmentsBox = cw.window.document.getElementById("attachments-box");
  cw.waitFor(() => !attachmentsBox.collapsed);
  Assert.ok(!attachmentsBox.collapsed);

  // Press again, should toggle to closed.
  cw.keypress(
    null,
    "m",
    AppConstants.platform == "macosx" ? { ctrlKey: true } : { altKey: true }
  );
  cw.waitFor(() => attachmentsBox.collapsed);
  Assert.ok(attachmentsBox.collapsed);

  close_compose_window(cw);
});
