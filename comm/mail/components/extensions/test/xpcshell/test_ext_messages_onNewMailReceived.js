/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at http://mozilla.org/MPL/2.0/. */

var { ExtensionTestUtils } = ChromeUtils.import(
  "resource://testing-common/ExtensionXPCShellUtils.jsm"
);

add_task(async function() {
  let account = createAccount();
  let inbox = await createSubfolder(account.incomingServer.rootFolder, "test1");

  let extension = ExtensionTestUtils.loadExtension({
    background: async () => {
      browser.messages.onNewMailReceived.addListener((folder, messageList) => {
        browser.test.sendMessage("newMessages", messageList.messages);
      });
    },
    manifest: { permissions: ["accountsRead", "messagesRead"] },
  });

  await extension.startup();

  await createMessages(inbox, 1);
  let inboxMessages = [...inbox.messages];

  let newMessages = await extension.awaitMessage("newMessages");
  equal(newMessages.length, 1);
  equal(newMessages[0].subject, inboxMessages[0].subject);

  await createMessages(inbox, 2);
  inboxMessages = [...inbox.messages];
  newMessages = await extension.awaitMessage("newMessages");
  equal(newMessages.length, 2);
  equal(newMessages[0].subject, inboxMessages[1].subject);
  equal(newMessages[1].subject, inboxMessages[2].subject);

  await extension.unload();
});
