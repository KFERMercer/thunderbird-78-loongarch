/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { OS } = ChromeUtils.import("resource://gre/modules/osfile.jsm");
const { getModelQuery, generateQueryURI } = ChromeUtils.import(
  "resource:///modules/ABQueryUtils.jsm"
);

const jsonFile = do_get_file("data/ldap_contacts.json");

add_task(async () => {
  let contents = await OS.File.read(jsonFile.path);
  let contacts = await JSON.parse(new TextDecoder().decode(contents));

  let dirPrefId = MailServices.ab.newAddressBook("new book", "", 101);
  let book = MailServices.ab.getDirectoryFromId(dirPrefId);

  for (let [name, { attributes }] of Object.entries(contacts)) {
    let card = Cc["@mozilla.org/addressbook/cardproperty;1"].createInstance(
      Ci.nsIAbCard
    );
    card.displayName = attributes.cn;
    card.firstName = attributes.givenName;
    card.lastName = attributes.sn;
    card.primaryEmail = attributes.mail;
    contacts[name] = book.addCard(card);
  }

  let doSearch = async function(searchString, ...expectedContacts) {
    let foundCards = await new Promise(resolve => {
      let listener = {
        cards: [],
        onSearchFoundCard(card) {
          this.cards.push(card);
        },
        onSearchFinished(status, secInfo, location) {
          resolve(this.cards);
        },
      };
      book.search(searchString, listener);
    });

    Assert.equal(foundCards.length, expectedContacts.length);
    for (let name of expectedContacts) {
      Assert.ok(foundCards.find(c => c.equals(contacts[name])));
    }
  };

  await doSearch("(DisplayName,c,watson)", "john", "mary");

  let modelQuery = getModelQuery("mail.addr_book.autocompletequery.format");
  await doSearch(
    generateQueryURI(modelQuery, ["holmes"]),
    "eurus",
    "mycroft",
    "sherlock"
  );
  await doSearch(generateQueryURI(modelQuery, ["adler"]), "irene");
  await doSearch(generateQueryURI(modelQuery, ["redbeard"]));
});
