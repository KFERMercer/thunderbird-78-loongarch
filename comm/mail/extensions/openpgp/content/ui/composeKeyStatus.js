/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { EnigmailFuncs } = ChromeUtils.import(
  "chrome://openpgp/content/modules/funcs.jsm"
);
var EnigmailKeyRing = ChromeUtils.import(
  "chrome://openpgp/content/modules/keyRing.jsm"
).EnigmailKeyRing;
var { EnigmailWindows } = ChromeUtils.import(
  "chrome://openpgp/content/modules/windows.jsm"
);
var { EnigmailKey } = ChromeUtils.import(
  "chrome://openpgp/content/modules/key.jsm"
);
const { OpenPGPAlias } = ChromeUtils.import(
  "chrome://openpgp/content/modules/OpenPGPAlias.jsm"
);
const { PgpSqliteDb2 } = ChromeUtils.import(
  "chrome://openpgp/content/modules/sqliteDb.jsm"
);

var gListBox;
var gViewButton;
var gLdapBundle;

var gEmailAddresses = [];
var gRowToEmail = [];

// One boolean entry per row. True means it is an alias row.
// This allows us to use different dialog behavior for alias entries.
var gAliasRows = [];

var gMapAddressToKeyObjs = null;

function addRecipients(toAddrList, recList) {
  for (var i = 0; i < recList.length; i++) {
    try {
      let entry = EnigmailFuncs.stripEmail(recList[i].replace(/[",]/g, ""));
      toAddrList.push(entry);
    } catch (ex) {
      console.debug(ex);
    }
  }
}

async function setListEntries() {
  gMapAddressToKeyObjs = new Map();

  for (let addr of gEmailAddresses) {
    addr = addr.toLowerCase();

    let statusStringID = null;
    let statusStringDirect = "";

    let aliasKeyList = EnigmailKeyRing.getAliasKeyList(addr);
    let isAlias = !!aliasKeyList;

    if (isAlias) {
      let aliasKeys = EnigmailKeyRing.getAliasKeys(aliasKeyList);
      if (!aliasKeys.length) {
        // failure, at least one alias key is unusable/unavailable
        statusStringDirect = gLdapBundle.getString("33");
      } else {
        // use a better string after 78, bug 1679301
        statusStringDirect = "a -> b";
      }
    } else {
      let foundKeys = await EnigmailKeyRing.getMultValidKeysForOneRecipient(
        addr
      );
      if (!foundKeys || !foundKeys.length) {
        statusStringID = "openpgp-recip-missing";
      } else {
        gMapAddressToKeyObjs.set(addr, foundKeys);
        for (let keyObj of foundKeys) {
          let goodPersonal = false;
          if (keyObj.secretAvailable) {
            goodPersonal = await PgpSqliteDb2.isAcceptedAsPersonalKey(
              keyObj.fpr
            );
          }
          if (
            goodPersonal ||
            keyObj.acceptance == "verified" ||
            keyObj.acceptance == "unverified"
          ) {
            statusStringID = "openpgp-recip-good";
            break;
          }
        }
        if (!statusStringID) {
          statusStringID = "openpgp-recip-none-accepted";
        }
      }
    }

    let listitem = document.createXULElement("richlistitem");

    let emailItem = document.createXULElement("label");
    emailItem.setAttribute("value", addr);
    emailItem.setAttribute("crop", "end");
    emailItem.setAttribute("style", "width: var(--recipientWidth)");
    listitem.appendChild(emailItem);

    let status = document.createXULElement("label");

    if (statusStringID) {
      document.l10n.setAttributes(status, statusStringID);
    } else {
      status.setAttribute("value", statusStringDirect);
    }

    status.setAttribute("crop", "end");
    status.setAttribute("style", "width: var(--statusWidth)");
    listitem.appendChild(status);

    gListBox.appendChild(listitem);

    gRowToEmail.push(addr);
    gAliasRows.push(isAlias);
  }
}

async function onLoad() {
  let params = window.arguments[0];
  if (!params) {
    return;
  }

  try {
    await OpenPGPAlias.load();
  } catch (ex) {
    console.log("failed to load OpenPGP alias file: " + ex);
  }

  gListBox = document.getElementById("infolist");
  gViewButton = document.getElementById("detailsButton");

  // Fix as part of bug 1679301
  gLdapBundle = document.getElementById("bundle_ldap");

  var arrLen = {};
  var recList;

  if (params.compFields.to) {
    recList = params.compFields.splitRecipients(
      params.compFields.to,
      true,
      arrLen
    );
    addRecipients(gEmailAddresses, recList);
  }
  if (params.compFields.cc) {
    recList = params.compFields.splitRecipients(
      params.compFields.cc,
      true,
      arrLen
    );
    addRecipients(gEmailAddresses, recList);
  }
  if (params.compFields.bcc) {
    recList = params.compFields.splitRecipients(
      params.compFields.bcc,
      true,
      arrLen
    );
    addRecipients(gEmailAddresses, recList);
  }

  await setListEntries();
}

async function reloadAndReselect(selIndex = -1) {
  while (true) {
    let child = gListBox.lastChild;
    // keep first child, which is the header
    if (child == gListBox.firstChild) {
      break;
    }
    gListBox.removeChild(child);
  }
  gRowToEmail = [];
  await setListEntries();
  gListBox.selectedIndex = selIndex;
}

function onSelectionChange(event) {
  // We don't offer detail management/discovery for email addresses
  // that match an alias rule.
  gViewButton.disabled =
    !gListBox.selectedItems.length || gAliasRows[gListBox.selectedIndex];
}

function viewSelectedEmail() {
  let selIndex = gListBox.selectedIndex;
  if (gViewButton.disabled || selIndex == -1) {
    return;
  }
  let email = gRowToEmail[selIndex];
  window.openDialog(
    "chrome://openpgp/content/ui/oneRecipientStatus.xhtml",
    "",
    "chrome,modal,resizable,centerscreen",
    {
      email,
      keys: gMapAddressToKeyObjs.get(email),
    }
  );
  reloadAndReselect(selIndex);
}
