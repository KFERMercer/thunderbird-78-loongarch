/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var { ExtensionTestUtils } = ChromeUtils.import(
  "resource://testing-common/ExtensionXPCShellUtils.jsm"
);
var { MailServices } = ChromeUtils.import(
  "resource:///modules/MailServices.jsm"
);
var { mailTestUtils } = ChromeUtils.import(
  "resource://testing-common/mailnews/MailTestUtils.jsm"
);
var { MessageGenerator } = ChromeUtils.import(
  "resource://testing-common/mailnews/MessageGenerator.jsm"
);
var { nsMailServer } = ChromeUtils.import(
  "resource://testing-common/mailnews/Maild.jsm"
);
var { OS } = ChromeUtils.import("resource://gre/modules/osfile.jsm");
var { PromiseTestUtils } = ChromeUtils.import(
  "resource://testing-common/mailnews/PromiseTestUtils.jsm"
);
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

ExtensionTestUtils.init(this);

var IS_IMAP = false;

function createAccount(type = "none") {
  let account;

  if (type == "local") {
    MailServices.accounts.createLocalMailAccount();
    account = MailServices.accounts.FindAccountForServer(
      MailServices.accounts.localFoldersServer
    );
  } else {
    account = MailServices.accounts.createAccount();
    account.incomingServer = MailServices.accounts.createIncomingServer(
      `${account.key}user`,
      "localhost",
      type
    );
  }

  if (type == "imap") {
    IMAPServer.open();
    account.incomingServer.port = IMAPServer.port;
    account.incomingServer.username = "user";
    account.incomingServer.password = "password";
  }

  info(`Created account ${account.toString()}`);
  return account;
}

function cleanUpAccount(account) {
  info(`Cleaning up account ${account.toString()}`);
  MailServices.accounts.removeAccount(account, true);
}

registerCleanupFunction(() => {
  MailServices.accounts.accounts.forEach(cleanUpAccount);
});

function addIdentity(account, email = "xpcshell@localhost") {
  let identity = MailServices.accounts.createIdentity();
  identity.email = email;
  account.addIdentity(identity);
  if (!account.defaultIdentity) {
    account.defaultIdentity = identity;
  }
  info(`Created identity ${identity.toString()}`);
  return identity;
}

async function createSubfolder(parent, name) {
  let promiseAdded = PromiseTestUtils.promiseFolderAdded(name);
  parent.createSubfolder(name, null);
  await promiseAdded;
  return parent.getChildNamed(name);
}

function createMessages(folder, count) {
  if (!createMessages.messageGenerator) {
    createMessages.messageGenerator = new MessageGenerator();
  }
  let messages = createMessages.messageGenerator.makeMessages({
    count,
    age_incr: { days: 2 },
  });

  if (folder.server.type == "imap") {
    return IMAPServer.addMessages(folder, messages);
  }

  let messageStrings = messages.map(message => message.toMboxString());
  folder.QueryInterface(Ci.nsIMsgLocalMailFolder);
  folder.addMessageBatch(messageStrings);
  folder.callFilterPlugins(null);

  return Promise.resolve();
}

async function getUtilsJS() {
  let contents = await OS.File.read(do_get_file("data/utils.js").path);
  return new TextDecoder().decode(contents);
}

var IMAPServer = {
  open() {
    let { imapDaemon, imapMessage, IMAP_RFC3501_handler } = ChromeUtils.import(
      "resource://testing-common/mailnews/Imapd.jsm"
    );
    IMAPServer.imapMessage = imapMessage;

    this.daemon = new imapDaemon();
    this.server = new nsMailServer(
      daemon => new IMAP_RFC3501_handler(daemon),
      this.daemon
    );
    this.server.start();

    registerCleanupFunction(() => this.close());
  },
  close() {
    this.server.stop();
  },
  get port() {
    return this.server.port;
  },

  addMessages(folder, messages) {
    let fakeFolder = IMAPServer.daemon.getMailbox(folder.name);
    messages.forEach(message => {
      let msgURI = Services.io.newURI(
        "data:text/plain;base64," + btoa(message.toMessageString())
      );
      let imapMsg = new IMAPServer.imapMessage(
        msgURI.spec,
        fakeFolder.uidnext++,
        []
      );
      fakeFolder.addMessage(imapMsg);
    });

    return new Promise(resolve =>
      mailTestUtils.updateFolderAndNotify(folder, resolve)
    );
  },
};
