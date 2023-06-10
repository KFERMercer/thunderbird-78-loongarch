/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at http://mozilla.org/MPL/2.0/. */

const EXPORTED_SYMBOLS = ["AddrBookMailingList"];

ChromeUtils.defineModuleGetter(
  this,
  "MailServices",
  "resource:///modules/MailServices.jsm"
);
ChromeUtils.defineModuleGetter(
  this,
  "Services",
  "resource://gre/modules/Services.jsm"
);
ChromeUtils.defineModuleGetter(
  this,
  "SimpleEnumerator",
  "resource:///modules/AddrBookUtils.jsm"
);

/* Prototype for mailing lists. A mailing list can appear as nsIAbDirectory
 * or as nsIAbCard. Here we keep all relevant information in the class itself
 * and fulfill each interface on demand. This will make more sense and be
 * a lot neater once we stop using two XPCOM interfaces for one job. */

function AddrBookMailingList(
  uid,
  parent,
  localId,
  name,
  nickName,
  description
) {
  this._uid = uid;
  this._parent = parent;
  this._localId = localId;
  this._name = name;
  this._nickName = nickName;
  this._description = description;
}
AddrBookMailingList.prototype = {
  get asDirectory() {
    let self = this;
    return {
      QueryInterface: ChromeUtils.generateQI([Ci.nsIAbDirectory]),
      classID: Components.ID("{e96ee804-0bd3-472f-81a6-8a9d65277ad3}"),

      get propertiesChromeURI() {
        return "chrome://messenger/content/addressbook/abAddressBookNameDialog.xhtml";
      },
      get UID() {
        return self._uid;
      },
      get URI() {
        return `${self._parent.URI}/MailList${self._localId}`;
      },
      get uuid() {
        return `&${self._name}`;
      },
      get dirName() {
        return self._name;
      },
      set dirName(value) {
        let oldValue = self._name;
        self._name = value;
        MailServices.ab.notifyItemPropertyChanged(
          this,
          "DirName",
          oldValue,
          value
        );
        // Fired twice for compatibility.
        MailServices.ab.notifyItemPropertyChanged(
          this,
          "DirName",
          oldValue,
          value
        );
      },
      get listNickName() {
        return self._nickName;
      },
      set listNickName(value) {
        self._nickName = value;
      },
      get description() {
        return self._description;
      },
      set description(value) {
        self._description = value;
      },
      get isMailList() {
        return true;
      },
      get childNodes() {
        return new SimpleEnumerator([]);
      },
      get childCards() {
        let selectStatement = self._parent._dbConnection.createStatement(
          "SELECT card FROM list_cards WHERE list = :list ORDER BY oid"
        );
        selectStatement.params.list = self._uid;
        let results = [];
        while (selectStatement.executeStep()) {
          results.push(
            self._parent._getCard({ uid: selectStatement.row.card })
          );
        }
        selectStatement.finalize();
        return new SimpleEnumerator(results);
      },
      get supportsMailingLists() {
        return false;
      },

      search(query, listener) {
        if (!listener) {
          return;
        }
        if (!query) {
          listener.onSearchFinished(Cr.NS_ERROR_FAILURE, null, "");
          return;
        }
        if (query[0] == "?") {
          query = query.substring(1);
        }

        let results = Array.from(this.childCards);

        // Process the query string into a tree of conditions to match.
        let lispRegexp = /^\((and|or|not|([^\)]*)(\)+))/;
        let index = 0;
        let rootQuery = { children: [], op: "or" };
        let currentQuery = rootQuery;

        while (true) {
          let match = lispRegexp.exec(query.substring(index));
          if (!match) {
            break;
          }
          index += match[0].length;

          if (["and", "or", "not"].includes(match[1])) {
            // For the opening bracket, step down a level.
            let child = {
              parent: currentQuery,
              children: [],
              op: match[1],
            };
            currentQuery.children.push(child);
            currentQuery = child;
          } else {
            let [name, condition, value] = match[2].split(",");
            currentQuery.children.push({
              name,
              condition,
              value: decodeURIComponent(value).toLowerCase(),
            });

            // For each closing bracket except the first, step up a level.
            for (let i = match[3].length - 1; i > 0; i--) {
              currentQuery = currentQuery.parent;
            }
          }
        }

        results = results.filter(card => {
          let properties = card._properties;
          let matches = b => {
            if ("condition" in b) {
              let { name, condition, value } = b;
              if (name == "IsMailList" && condition == "=") {
                return value == "true";
              }

              if (!properties.has(name)) {
                return condition == "!ex";
              }
              if (condition == "ex") {
                return true;
              }

              let cardValue = properties.get(name).toLowerCase();
              switch (condition) {
                case "=":
                  return cardValue == value;
                case "!=":
                  return cardValue != value;
                case "lt":
                  return cardValue < value;
                case "gt":
                  return cardValue > value;
                case "bw":
                  return cardValue.startsWith(value);
                case "ew":
                  return cardValue.endsWith(value);
                case "c":
                  return cardValue.includes(value);
                case "!c":
                  return !cardValue.includes(value);
                case "~=":
                case "regex":
                default:
                  return false;
              }
            }
            if (b.op == "or") {
              return b.children.some(bb => matches(bb));
            }
            if (b.op == "and") {
              return b.children.every(bb => matches(bb));
            }
            if (b.op == "not") {
              return !matches(b.children[0]);
            }
            return false;
          };

          return matches(rootQuery);
        }, this);

        for (let card of results) {
          listener.onSearchFoundCard(card);
        }
        listener.onSearchFinished(Cr.NS_OK, null, "");
      },
      addCard(card) {
        if (!card.primaryEmail) {
          return card;
        }
        if (!self._parent.hasCard(card)) {
          card = self._parent.addCard(card);
        }
        let insertStatement = self._parent._dbConnection.createStatement(
          "REPLACE INTO list_cards (list, card) VALUES (:list, :card)"
        );
        insertStatement.params.list = self._uid;
        insertStatement.params.card = card.UID;
        insertStatement.execute();
        MailServices.ab.notifyItemPropertyChanged(card, null, null, null);
        MailServices.ab.notifyItemPropertyChanged(card, null, null, null);
        MailServices.ab.notifyDirectoryItemAdded(this, card);
        Services.obs.notifyObservers(
          card,
          "addrbook-list-member-added",
          self._uid
        );
        insertStatement.finalize();
        return card;
      },
      deleteCards(cards) {
        let deleteCardStatement = self._parent._dbConnection.createStatement(
          "DELETE FROM list_cards WHERE list = :list AND card = :card"
        );
        for (let card of cards) {
          deleteCardStatement.params.list = self._uid;
          deleteCardStatement.params.card = card.UID;
          deleteCardStatement.execute();
          if (self._parent._dbConnection.affectedRows) {
            MailServices.ab.notifyDirectoryItemDeleted(this, card);
            Services.obs.notifyObservers(
              card,
              "addrbook-list-member-removed",
              self._uid
            );
          }
          deleteCardStatement.reset();
        }
        deleteCardStatement.finalize();
      },
      dropCard(card, needToCopyCard) {
        if (needToCopyCard) {
          card = self._parent.dropCard(card, true);
        }
        this.addCard(card);
        Services.obs.notifyObservers(
          card,
          "addrbook-list-member-added",
          self._uid
        );
      },
      editMailListToDatabase(listCard) {
        // Check if the new name is empty.
        if (!self._name) {
          throw new Components.Exception(
            "Invalid mailing list name",
            Cr.NS_ERROR_ILLEGAL_VALUE
          );
        }

        // Check if the new name contains 2 spaces.
        if (self._name.match("  ")) {
          throw new Components.Exception(
            "Invalid mailing list name",
            Cr.NS_ERROR_ILLEGAL_VALUE
          );
        }

        // Check if the new name contains the following special characters.
        for (let char of ',;"<>') {
          if (self._name.includes(char)) {
            throw new Components.Exception(
              "Invalid mailing list name",
              Cr.NS_ERROR_ILLEGAL_VALUE
            );
          }
        }

        self._parent._saveList(self);
        Services.obs.notifyObservers(
          this,
          "addrbook-list-updated",
          self._parent.UID
        );
      },
    };
  },
  get asCard() {
    let self = this;
    return {
      QueryInterface: ChromeUtils.generateQI([Ci.nsIAbCard]),
      classID: Components.ID("{1143991d-31cd-4ea6-9c97-c587d990d724}"),

      get UID() {
        return self._uid;
      },
      get uuid() {
        return MailServices.ab.generateUUID(self._parent.uuid, self._localId);
      },
      get isMailList() {
        return true;
      },
      get mailListURI() {
        return `${self._parent.URI}/MailList${self._localId}`;
      },

      get directoryId() {
        return self._parent.uuid;
      },
      get localId() {
        return self._localId;
      },
      get firstName() {
        return "";
      },
      get lastName() {
        return self._name;
      },
      get displayName() {
        return self._name;
      },
      set displayName(value) {
        self._name = value;
      },
      get primaryEmail() {
        return "";
      },

      generateName(generateFormat) {
        return self._name;
      },
      getProperty(name, defaultValue) {
        switch (name) {
          case "NickName":
            return self._nickName;
          case "Notes":
            return self._description;
        }
        return defaultValue;
      },
      setProperty(name, value) {
        switch (name) {
          case "NickName":
            self._nickName = value;
            break;
          case "Notes":
            self._description = value;
            break;
        }
      },
      equals(card) {
        return self._uid == card.UID;
      },
      hasEmailAddress(emailAddress) {
        return false;
      },
      get properties() {
        let entries = [];
        entries.push(["DisplayName", this.displayName]);
        entries.push(["NickName", this.getProperty("NickName", "")]);
        entries.push(["Notes", this.getProperty("Notes", "")]);
        let enumerator = {
          hasMoreElements() {
            return entries.length > 0;
          },
          getNext() {
            if (!this.hasMoreElements()) {
              throw Components.Exception("No next!", Cr.NS_ERROR_NOT_AVAILABLE);
            }
            let [name, value] = entries.shift();
            return {
              get name() {
                return name;
              },
              get value() {
                return value;
              },
              QueryInterface: ChromeUtils.generateQI([Ci.nsIProperty]),
            };
          },
          *[Symbol.iterator]() {
            while (this.hasMoreElements()) {
              yield this.getNext();
            }
          },
          QueryInterface: ChromeUtils.generateQI([Ci.nsISimpleEnumerator]),
        };
        return enumerator;
      },
      translateTo(type) {
        // Get nsAbCardProperty to do the work, the code is in C++ anyway.
        let cardCopy = Cc[
          "@mozilla.org/addressbook/cardproperty;1"
        ].createInstance(Ci.nsIAbCard);
        cardCopy.UID = this.UID;
        cardCopy.copy(this);
        return cardCopy.translateTo(type);
      },
    };
  },
};
