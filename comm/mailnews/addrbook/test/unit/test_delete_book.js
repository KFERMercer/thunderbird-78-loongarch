/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var { MailServices } = ChromeUtils.import(
  "resource:///modules/MailServices.jsm"
);
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

function getExistingDirectories() {
  return Array.from(MailServices.ab.directories, d => d.dirPrefId);
}

add_task(async function clearPref() {
  Assert.deepEqual(getExistingDirectories(), [
    "ldap_2.servers.pab",
    "ldap_2.servers.history",
  ]);
  equal(
    Services.prefs.getStringPref("mail.collect_addressbook"),
    "jsaddrbook://history.sqlite"
  );

  let dirPrefId = MailServices.ab.newAddressBook("delete me", "", 101);
  let book = MailServices.ab.getDirectoryFromId(dirPrefId);

  Assert.deepEqual(getExistingDirectories(), [
    "ldap_2.servers.deleteme",
    "ldap_2.servers.pab",
    "ldap_2.servers.history",
  ]);
  Services.prefs.setStringPref("mail.collect_addressbook", book.URI);

  MailServices.ab.deleteAddressBook(book.URI);
  await promiseDirectoryRemoved();

  Assert.deepEqual(getExistingDirectories(), [
    "ldap_2.servers.pab",
    "ldap_2.servers.history",
  ]);
  equal(
    Services.prefs.getStringPref("mail.collect_addressbook"),
    "jsaddrbook://history.sqlite"
  );
});

add_task(async function protectBuiltIns() {
  Assert.deepEqual(getExistingDirectories(), [
    "ldap_2.servers.pab",
    "ldap_2.servers.history",
  ]);
  equal(
    Services.prefs.getStringPref("mail.collect_addressbook"),
    "jsaddrbook://history.sqlite"
  );

  Assert.throws(() => {
    MailServices.ab.deleteAddressBook("this is completely wrong");
  }, /NS_ERROR_MALFORMED_URI/);
  Assert.throws(() => {
    MailServices.ab.deleteAddressBook("jsaddrbook://bad.sqlite");
  }, /NS_ERROR_UNEXPECTED/);
  Assert.throws(() => {
    MailServices.ab.deleteAddressBook("jsaddrbook://history.sqlite");
  }, /NS_ERROR_FAILURE/);
  Assert.throws(() => {
    MailServices.ab.deleteAddressBook("jsaddrbook://abook.sqlite");
  }, /NS_ERROR_FAILURE/);

  Assert.deepEqual(getExistingDirectories(), [
    "ldap_2.servers.pab",
    "ldap_2.servers.history",
  ]);
  equal(
    Services.prefs.getStringPref("mail.collect_addressbook"),
    "jsaddrbook://history.sqlite"
  );
});
