/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Tests for the account settings manage identity.
 */

"use strict";

var elib = ChromeUtils.import(
  "resource://testing-common/mozmill/elementslib.jsm"
);

var {
  click_account_tree_row,
  get_account_tree_row,
  open_advanced_settings,
  openAccountSettings,
} = ChromeUtils.import(
  "resource://testing-common/mozmill/AccountManagerHelpers.jsm"
);
const { wait_for_frame_load } = ChromeUtils.import(
  "resource://testing-common/mozmill/WindowHelpers.jsm"
);
var { input_value, delete_all_existing } = ChromeUtils.import(
  "resource://testing-common/mozmill/KeyboardHelpers.jsm"
);
var { gMockPromptService } = ChromeUtils.import(
  "resource://testing-common/mozmill/PromptHelpers.jsm"
);
var { plan_for_modal_dialog, wait_for_modal_dialog } = ChromeUtils.import(
  "resource://testing-common/mozmill/WindowHelpers.jsm"
);

var { MailServices } = ChromeUtils.import(
  "resource:///modules/MailServices.jsm"
);
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

var { mc } = ChromeUtils.import(
  "resource://testing-common/mozmill/FolderDisplayHelpers.jsm"
);

const { OpenPGPTestUtils } = ChromeUtils.import(
  "resource://testing-common/mozmill/OpenPGPTestUtils.jsm"
);

var gPopAccount, gOriginalAccountCount, gIdentitiesWin;

/**
 * Load the identities dialog.
 *
 * @return {Window} The loaded window of the identities dialog.
 */
async function identitiesListDialogLoaded(win) {
  let manageButton = win.document.getElementById(
    "identity.manageIdentitiesbutton"
  );
  let identitiesDialogLoad = promiseLoadSubDialog(
    "chrome://messenger/content/am-identities-list.xhtml"
  );
  EventUtils.synthesizeMouseAtCenter(manageButton, {}, win);
  return identitiesDialogLoad;
}

/**
 * Load an identity listed in the identities dialog.
 *
 * @param {Number} identityIdx - The index of the identity, in the list.
 * @return {Window} The loaded window of the identities dialog.
 */
async function identityDialogLoaded(identityIdx) {
  let identitiesList = gIdentitiesWin.document.getElementById("identitiesList");

  // Let's dbl click to open the identity.
  let identityDialogLoaded = promiseLoadSubDialog(
    "chrome://messenger/content/am-identity-edit.xhtml"
  );
  EventUtils.synthesizeMouseAtCenter(
    identitiesList.children[identityIdx],
    { clickCount: 2 },
    gIdentitiesWin
  );
  return identityDialogLoaded;
}

/** Close the open dialog. */
async function dialogClosed(win) {
  let dialogElement = win.document.querySelector("dialog");
  let dialogClosing = BrowserTestUtils.waitForEvent(
    dialogElement,
    "dialogclosing"
  );
  dialogElement.acceptDialog();
  return dialogClosing;
}

add_task(async function setup() {
  // There may be pre-existing accounts from other tests.
  gOriginalAccountCount = MailServices.accounts.allServers.length;

  // Create a POP server
  let popServer = MailServices.accounts
    .createIncomingServer("nobody", "exampleX.invalid", "pop3")
    .QueryInterface(Ci.nsIPop3IncomingServer);

  let identity = MailServices.accounts.createIdentity();
  identity.email = "tinderbox@example.invalid";

  gPopAccount = MailServices.accounts.createAccount();
  gPopAccount.incomingServer = popServer;
  gPopAccount.addIdentity(identity);

  // Now there should be one more account.
  Assert.equal(
    MailServices.accounts.allServers.length,
    gOriginalAccountCount + 1
  );

  registerCleanupFunction(function rmAccount() {
    // Remove our test account to leave the profile clean.
    MailServices.accounts.removeAccount(gPopAccount);
    // There should be only the original accounts left.
    Assert.equal(
      MailServices.accounts.allServers.length,
      gOriginalAccountCount
    );
  });

  // Go to the account settings.
  let tab = await openAccountSettings();
  registerCleanupFunction(function closeTab() {
    mc.tabmail.closeTab(tab);
  });

  // To the account main page.
  let accountRow = get_account_tree_row(
    gPopAccount.key,
    null, // "am-main.xhtml",
    tab
  );
  click_account_tree_row(tab, accountRow);

  // Click "Manage Identities" to show the list of identities.
  let iframe = tab.browser.contentWindow.document.getElementById(
    "contentFrame"
  );
  gIdentitiesWin = await identitiesListDialogLoaded(iframe.contentWindow);
});

/**
 * Test that adding a new identity works, and that the identity is listed
 * once the dialog to add new identity closes.
 */
add_task(async function test_add_identity() {
  let identitiesList = gIdentitiesWin.document.getElementById("identitiesList");

  Assert.equal(
    identitiesList.childElementCount,
    1,
    "should start with 1 identity"
  );

  // Open the dialog to add a new identity.
  let identityDialogLoaded = promiseLoadSubDialog(
    "chrome://messenger/content/am-identity-edit.xhtml"
  );
  let addButton = gIdentitiesWin.document.getElementById("addButton");
  EventUtils.synthesizeMouseAtCenter(addButton, {}, gIdentitiesWin);
  let identityWin = await identityDialogLoaded;

  // Fill in some values, and close. The new identity should now be listed.
  identityWin.document.getElementById("identity.fullName").focus();
  EventUtils.sendString("bob", identityWin);
  identityWin.document.getElementById("identity.email").focus();
  EventUtils.sendString("bob@openpgp.example", identityWin);

  // Check the e2e tab is only available for existing identities that
  // have the email set - that is, it should not be shown yet.
  Assert.ok(identityWin.document.getElementById("identityE2ETab").hidden);

  await dialogClosed(identityWin);

  Assert.equal(
    identitiesList.childElementCount,
    2,
    "should have 2 identities now"
  );
});

async function test_identity_idx(idx) {
  info(`Checking identity #${idx}`);
  let identityWin = await identityDialogLoaded(idx);

  let identity = gPopAccount.identities[idx];
  Assert.ok(!!identity, "identity #1 should be set");

  // The e2e tab should now be shown.
  Assert.ok(!identityWin.document.getElementById("identityE2ETab").hidden);
  EventUtils.synthesizeMouseAtCenter(
    identityWin.document.getElementById("identityE2ETab"),
    {},
    gIdentitiesWin
  );

  Assert.equal(
    identityWin.document.getElementById("openPgpKeyListRadio").value,
    identity.getCharAttribute("openpgp_key_id"),
    "Key should be correct"
  );

  Assert.equal(
    identityWin.document
      .getElementById("openPgpKeyListRadio")
      .querySelectorAll("radio[selected]").length,
    1,
    "Should have exactly one key selected (can be None)"
  );

  Assert.equal(
    identityWin.document.getElementById("encryptionChoices").value,
    identity.getIntAttribute("encryptionpolicy"),
    "Encrypt setting should be correct"
  );

  // Signing checked based on the pref.
  Assert.equal(
    identityWin.document.getElementById("identity_sign_mail").checked,
    identity.getBoolAttribute("sign_mail")
  );
  // Disabled if the identity don't have a key configured.
  Assert.equal(
    identityWin.document.getElementById("identity_sign_mail").disabled,
    !identity.getCharAttribute("openpgp_key_id")
  );

  return dialogClosed(identityWin);
}

add_task(async function test_identity_idx_1() {
  return test_identity_idx(1);
});

add_task(async function test_identity_changes() {
  // Let's poke identity 1 and check the changes got applied
  let identity = gPopAccount.identities[1];
  // Note: can't set the prefs to encrypt/sign unless there's also a key.

  let [id] = await OpenPGPTestUtils.importPrivateKey(
    window,
    new FileUtils.File(
      getTestFilePath(
        "../openpgp/data/keys/bob@openpgp.example-0xfbfcc82a015e7330-secret.asc"
      )
    )
  );
  info(`Set up openpgp key; id=${id}`);

  identity.setUnicharAttribute("openpgp_key_id", id.split("0x").join(""));
  identity.setBoolAttribute("sign_mail", "true"); // Sign by default.
  identity.setIntAttribute("encryptionpolicy", 2); // Require encryption.
  info("Modified identity 1 - will check it now");
  await test_identity_idx(1);

  info("Will load identity 0 again and re-check that");
  await test_identity_idx(0);
});
