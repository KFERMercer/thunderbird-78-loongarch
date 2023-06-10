/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Tests proper enabling of addressing widgets.
 */

/* globals gFolderTreeView */

"use strict";

var { close_compose_window, open_compose_new_mail } = ChromeUtils.import(
  "resource://testing-common/mozmill/ComposeHelpers.jsm"
);
var { be_in_folder, FAKE_SERVER_HOSTNAME } = ChromeUtils.import(
  "resource://testing-common/mozmill/FolderDisplayHelpers.jsm"
);

var { fixIterator } = ChromeUtils.import(
  "resource:///modules/iteratorUtils.jsm"
);
var { MailServices } = ChromeUtils.import(
  "resource:///modules/MailServices.jsm"
);

var cwc = null; // compose window controller
var accountPOP3 = null;
var accountNNTP = null;
var originalAccountCount;

add_task(function setupModule(module) {
  gFolderTreeView._tree.focus();

  // Ensure we're in the tinderbox account as that has the right identities set
  // up for this test.
  let server = MailServices.accounts.FindServer(
    "tinderbox",
    FAKE_SERVER_HOSTNAME,
    "pop3"
  );
  accountPOP3 = MailServices.accounts.FindAccountForServer(server);

  // There may be pre-existing accounts from other tests.
  originalAccountCount = MailServices.accounts.allServers.length;
});

/**
 * Check if the address type items are in the wished state.
 *
 * @param aItemsEnabled  List of item values that should be enabled (uncollapsed).
 */
function check_address_types_state(aItemsEnabled) {
  let addr_types = document.querySelectorAll("label.recipient-label");
  for (let item of addr_types) {
    Assert.ok(item.collapsed != aItemsEnabled.includes(item.id));
  }
}

/**
 * With only a POP3 account, no News related address types should be enabled.
 */
function check_mail_address_types() {
  check_address_types_state(["addr_to", "addr_cc", "addr_reply", "addr_bcc"]);
}

/**
 * With a NNTP account, all address types should be enabled.
 */
function check_nntp_address_types() {
  check_address_types_state([
    "addr_to",
    "addr_cc",
    "addr_reply",
    "addr_bcc",
    "addr_newsgroups",
    "addr_followup",
  ]);
}

/**
 * With an NNTP account, the 'To' addressing row should be hidden.
 */
function check_collapsed_pop_recipient(cwc) {
  Assert.ok(cwc.e("addressRowTo").classList.contains("hidden"));
}

function add_NNTP_account() {
  // Create a NNTP server
  let nntpServer = MailServices.accounts
    .createIncomingServer(null, "example.nntp.invalid", "nntp")
    .QueryInterface(Ci.nsINntpIncomingServer);

  let identity = MailServices.accounts.createIdentity();
  identity.email = "tinderbox2@example.invalid";

  accountNNTP = MailServices.accounts.createAccount();
  accountNNTP.incomingServer = nntpServer;
  accountNNTP.addIdentity(identity);
  // Now there should be 1 more account.
  Assert.equal(
    MailServices.accounts.allServers.length,
    originalAccountCount + 1
  );
}

function remove_NNTP_account() {
  // Remove our NNTP account to leave the profile clean.
  MailServices.accounts.removeAccount(accountNNTP);
  // There should be only the original accounts left.
  Assert.equal(MailServices.accounts.allServers.length, originalAccountCount);
}

/**
 * Bug 399446 & bug 922614
 * Test that the allowed address types depend on the account type
 * we are sending from.
 */
add_task(function test_address_types() {
  // Be sure there is no NNTP account yet.
  for (let account of MailServices.accounts.accounts) {
    Assert.notEqual(
      account.incomingServer.type,
      "nntp",
      "There is a NNTP account existing unexpectedly"
    );
  }

  // Open compose window on the existing POP3 account.
  be_in_folder(accountPOP3.incomingServer.rootFolder);
  cwc = open_compose_new_mail();
  check_mail_address_types();
  close_compose_window(cwc);

  add_NNTP_account();

  // From now on, we should always get all possible address types offered,
  // regardless of which account is used of composing (bug 922614).
  be_in_folder(accountNNTP.incomingServer.rootFolder);
  cwc = open_compose_new_mail();
  check_nntp_address_types();
  check_collapsed_pop_recipient(cwc);
  close_compose_window(cwc);

  // Now try the same accounts but choosing them in the From dropdown
  // inside compose window.
  be_in_folder(accountPOP3.incomingServer.rootFolder);
  cwc = open_compose_new_mail();
  check_nntp_address_types();

  let NNTPidentity = accountNNTP.defaultIdentity.key;
  cwc.click(cwc.eid("msgIdentity"));
  cwc.click_menus_in_sequence(cwc.e("msgIdentityPopup"), [
    { identitykey: NNTPidentity },
  ]);
  check_nntp_address_types();

  // Switch back to the POP3 account.
  let POP3identity = accountPOP3.defaultIdentity.key;
  cwc.click(cwc.eid("msgIdentity"));
  cwc.click_menus_in_sequence(cwc.e("msgIdentityPopup"), [
    { identitykey: POP3identity },
  ]);
  check_nntp_address_types();

  close_compose_window(cwc);

  remove_NNTP_account();

  // Now the NNTP account is lost, so we should be back to mail only addressees.
  be_in_folder(accountPOP3.incomingServer.rootFolder);
  cwc = open_compose_new_mail();
  check_mail_address_types();
  close_compose_window(cwc);
});
