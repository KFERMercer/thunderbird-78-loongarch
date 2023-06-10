/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at http://mozilla.org/MPL/2.0/. */
var { MailServices } = ChromeUtils.import(
  "resource:///modules/MailServices.jsm"
);

let account = createAccount("pop3");
createAccount("local");
MailServices.accounts.defaultAccount = account;

let defaultIdentity = addIdentity(account);
defaultIdentity.composeHtml = true;
let nonDefaultIdentity = addIdentity(account);
nonDefaultIdentity.composeHtml = false;

let rootFolder = account.incomingServer.rootFolder;
rootFolder.createSubfolder("test", null);
let folder = rootFolder.getChildNamed("test");
createMessages(folder, 4);

add_task(async function testIdentity() {
  let files = {
    "background.js": async () => {
      let accounts = await browser.accounts.list();
      browser.test.assertEq(2, accounts.length, "number of accounts");
      browser.test.assertEq(
        2,
        accounts[0].identities.length,
        "number of identities"
      );
      let [defaultIdentity, nonDefaultIdentity] = accounts[0].identities;
      let folder = accounts[0].folders.find(f => f.name == "test");
      let { messages } = await browser.messages.list(folder);
      browser.test.assertEq(4, messages.length, "number of messages");

      browser.test.log(defaultIdentity.id);
      browser.test.log(nonDefaultIdentity.id);

      let funcs = [
        { name: "beginNew", args: [] },
        { name: "beginReply", args: [messages[0].id] },
        { name: "beginForward", args: [messages[1].id, "forwardAsAttachment"] },
        // Uses a different code path.
        { name: "beginForward", args: [messages[2].id, "forwardInline"] },
        { name: "beginNew", args: [messages[3].id] },
      ];
      let tests = [
        { args: [], isDefault: true },
        {
          args: [{ identityId: defaultIdentity.id }],
          isDefault: true,
        },
        {
          args: [{ identityId: nonDefaultIdentity.id }],
          isDefault: false,
        },
      ];
      for (let func of funcs) {
        browser.test.log(func.name);
        for (let test of tests) {
          browser.test.log(JSON.stringify(test.args));
          let tab = await browser.compose[func.name](
            ...func.args.concat(test.args)
          );
          browser.test.assertEq("object", typeof tab);
          browser.test.assertEq("number", typeof tab.id);
          await window.sendMessage("checkIdentity", test.isDefault);
        }
      }

      browser.test.notifyPass("finished");
    },
    "utils.js": await getUtilsJS(),
  };
  let extension = ExtensionTestUtils.loadExtension({
    files,
    manifest: {
      background: { scripts: ["utils.js", "background.js"] },
      permissions: ["accountsRead", "messagesRead"],
    },
  });

  extension.onMessage("checkIdentity", async isDefault => {
    let composeWindows = [...Services.wm.getEnumerator("msgcompose")];
    is(composeWindows.length, 1);
    await new Promise(resolve => composeWindows[0].setTimeout(resolve));

    is(
      composeWindows[0].getCurrentIdentityKey(),
      isDefault ? defaultIdentity.key : nonDefaultIdentity.key
    );
    composeWindows[0].close();
    extension.sendMessage();
  });

  await extension.startup();
  await extension.awaitFinish("finished");
  await extension.unload();
});

add_task(async function testHeaders() {
  let files = {
    "background.js": async () => {
      async function checkHeaders(expected) {
        let [createdWindow] = await createdWindowPromise;
        browser.test.assertEq("messageCompose", createdWindow.type);
        browser.test.sendMessage("checkHeaders", expected);
        await window.waitForMessage();
        let removedWindowPromise = window.waitForEvent("windows.onRemoved");
        browser.windows.remove(createdWindow.id);
        await removedWindowPromise;
      }

      let accounts = await browser.accounts.list();
      browser.test.assertEq(2, accounts.length, "number of accounts");
      let folder = accounts[0].folders.find(f => f.name == "test");
      let { messages } = await browser.messages.list(folder);
      browser.test.assertEq(4, messages.length, "number of messages");

      let addressBook = await browser.addressBooks.create({
        name: "Baker Street",
      });
      let contacts = {
        sherlock: await browser.contacts.create(addressBook, {
          DisplayName: "Sherlock Holmes",
          PrimaryEmail: "sherlock@bakerstreet.invalid",
        }),
        john: await browser.contacts.create(addressBook, {
          DisplayName: "John Watson",
          PrimaryEmail: "john@bakerstreet.invalid",
        }),
      };
      let list = await browser.mailingLists.create(addressBook, {
        name: "Holmes and Watson",
        description: "Tenants221B",
      });
      await browser.mailingLists.addMember(list, contacts.sherlock);
      await browser.mailingLists.addMember(list, contacts.john);

      let createdWindowPromise;

      // Start a new message.

      createdWindowPromise = window.waitForEvent("windows.onCreated");
      await browser.compose.beginNew();
      await checkHeaders({});

      // Start a new message, with a subject and recipients as strings.

      createdWindowPromise = window.waitForEvent("windows.onCreated");
      await browser.compose.beginNew({
        to: "Sherlock Holmes <sherlock@bakerstreet.invalid>",
        cc: "John Watson <john@bakerstreet.invalid>",
        subject: "Did you miss me?",
      });
      await checkHeaders({
        to: ["Sherlock Holmes <sherlock@bakerstreet.invalid>"],
        cc: ["John Watson <john@bakerstreet.invalid>"],
        subject: "Did you miss me?",
      });

      // Start a new message, with a subject and recipients as string arrays.

      createdWindowPromise = window.waitForEvent("windows.onCreated");
      await browser.compose.beginNew({
        to: ["Sherlock Holmes <sherlock@bakerstreet.invalid>"],
        cc: ["John Watson <john@bakerstreet.invalid>"],
        subject: "Did you miss me?",
      });
      await checkHeaders({
        to: ["Sherlock Holmes <sherlock@bakerstreet.invalid>"],
        cc: ["John Watson <john@bakerstreet.invalid>"],
        subject: "Did you miss me?",
      });

      // Start a new message, with a subject and recipients as contacts.

      createdWindowPromise = window.waitForEvent("windows.onCreated");
      await browser.compose.beginNew({
        to: [{ id: contacts.sherlock, type: "contact" }],
        cc: [{ id: contacts.john, type: "contact" }],
        subject: "Did you miss me?",
      });
      await checkHeaders({
        to: ["Sherlock Holmes <sherlock@bakerstreet.invalid>"],
        cc: ["John Watson <john@bakerstreet.invalid>"],
        subject: "Did you miss me?",
      });

      // Start a new message, with a subject and recipients as a mailing list.

      createdWindowPromise = window.waitForEvent("windows.onCreated");
      await browser.compose.beginNew({
        to: [{ id: list, type: "mailingList" }],
        subject: "Did you miss me?",
      });
      await checkHeaders({
        to: ["Holmes and Watson <Tenants221B>"],
        subject: "Did you miss me?",
      });

      // Reply to a message.

      createdWindowPromise = window.waitForEvent("windows.onCreated");
      await browser.compose.beginReply(messages[0].id);
      await checkHeaders({
        to: [messages[0].author.replace(/"/g, "")],
        subject: `Re: ${messages[0].subject}`,
      });

      // Forward a message.

      createdWindowPromise = window.waitForEvent("windows.onCreated");
      await browser.compose.beginForward(
        messages[1].id,
        "forwardAsAttachment",
        {
          to: ["Mycroft Holmes <mycroft@bakerstreet.invalid>"],
        }
      );
      await checkHeaders({
        to: ["Mycroft Holmes <mycroft@bakerstreet.invalid>"],
        subject: `Fwd: ${messages[1].subject}`,
      });

      // Forward a message inline. This uses a different code path.

      createdWindowPromise = window.waitForEvent("windows.onCreated");
      await browser.compose.beginForward(messages[2].id, "forwardInline", {
        to: ["Mycroft Holmes <mycroft@bakerstreet.invalid>"],
      });
      await checkHeaders({
        to: ["Mycroft Holmes <mycroft@bakerstreet.invalid>"],
        subject: `Fwd: ${messages[2].subject}`,
      });

      await browser.addressBooks.delete(addressBook);
      browser.test.notifyPass("finished");
    },
    "utils.js": await getUtilsJS(),
  };
  let extension = ExtensionTestUtils.loadExtension({
    files,
    manifest: {
      background: { scripts: ["utils.js", "background.js"] },
      permissions: ["accountsRead", "addressBooks", "messagesRead"],
    },
  });

  extension.onMessage("checkHeaders", async expected => {
    await checkComposeHeaders(expected);
    extension.sendMessage();
  });

  await extension.startup();
  await extension.awaitFinish("finished");
  await extension.unload();
});

add_task(async function testBody() {
  let files = {
    "background.js": async () => {
      let accounts = await browser.accounts.list();
      browser.test.assertEq(2, accounts.length, "number of accounts");
      browser.test.assertEq(
        2,
        accounts[0].identities.length,
        "number of identities"
      );
      let [htmlIdentity, plainTextIdentity] = accounts[0].identities;
      let folder = accounts[0].folders.find(f => f.name == "test");
      let { messages } = await browser.messages.list(folder);
      browser.test.assertEq(4, messages.length, "number of messages");

      let message0 = await browser.messages.getFull(messages[0].id);
      let message0body = message0.parts[0].body;

      let emptyHTML = "<body>\n<p><br>\n</p>\n";
      let plainTextBodyTag =
        '<body style="font-family: -moz-fixed; white-space: pre-wrap; width: 72ch;">';
      let tests = [
        {
          // No arguments.
          funcName: "beginNew",
          arguments: [],
          expected: {
            isHTML: true,
            htmlIncludes: emptyHTML,
            plainTextIs: "\n",
          },
        },
        {
          // Empty arguments.
          funcName: "beginNew",
          arguments: [{}],
          expected: {
            isHTML: true,
            htmlIncludes: emptyHTML,
            plainTextIs: "\n",
          },
        },
        {
          // Empty HTML.
          funcName: "beginNew",
          arguments: [{ body: "" }],
          expected: {
            isHTML: true,
            htmlIncludes: emptyHTML,
            plainTextIs: "\n",
          },
        },
        {
          // Empty plain text.
          funcName: "beginNew",
          arguments: [{ plainTextBody: "" }],
          expected: {
            isHTML: false,
            plainTextIs: "",
          },
        },
        {
          // Empty enforced plain text with default identity.
          funcName: "beginNew",
          arguments: [{ plainTextBody: "", isPlainText: true }],
          expected: {
            isHTML: false,
            plainTextIs: "",
          },
        },
        {
          // Empty HTML for plaintext identity.
          funcName: "beginNew",
          arguments: [{ body: "", identityId: plainTextIdentity.id }],
          expected: {
            isHTML: true,
            htmlIncludes: emptyHTML,
            plainTextIs: "\n",
          },
        },
        {
          // Empty plain text for plaintext identity.
          funcName: "beginNew",
          arguments: [{ plainTextBody: "", identityId: plainTextIdentity.id }],
          expected: {
            isHTML: false,
            plainTextIs: "",
          },
        },
        {
          // Empty HTML for plaintext identity enforcing HTML.
          funcName: "beginNew",
          arguments: [
            { body: "", identityId: plainTextIdentity.id, isPlainText: false },
          ],
          expected: {
            isHTML: true,
            htmlIncludes: emptyHTML,
            plainTextIs: "\n",
          },
        },
        {
          // Empty plain text and isPlainText.
          funcName: "beginNew",
          arguments: [{ plainTextBody: "", isPlainText: true }],
          expected: { isHTML: false, plainTextIs: "" },
        },
        {
          // Non-empty HTML.
          funcName: "beginNew",
          arguments: [{ body: "<p>I'm an HTML message!</p>" }],
          expected: {
            isHTML: true,
            htmlIncludes: "<body>\n<p>I'm an HTML message!</p>\n</body>",
            plainTextIs: "I'm an HTML message!",
          },
        },
        {
          // Non-empty plain text.
          funcName: "beginNew",
          arguments: [{ plainTextBody: "I'm a plain text message!" }],
          expected: {
            isHTML: false,
            htmlIncludes: plainTextBodyTag + "I'm a plain text message!</body>",
            plainTextIs: "I'm a plain text message!",
          },
        },
        {
          // Non-empty plain text and isPlainText.
          funcName: "beginNew",
          arguments: [
            {
              plainTextBody: "I'm a plain text message!",
              isPlainText: true,
            },
          ],
          expected: {
            isHTML: false,
            htmlIncludes: plainTextBodyTag + "I'm a plain text message!</body>",
            plainTextIs: "I'm a plain text message!",
          },
        },
        {
          // HTML and plain text. Invalid.
          funcName: "beginNew",
          arguments: [{ body: "", plainTextBody: "" }],
          throws: true,
        },
        {
          // HTML and isPlainText. Invalid.
          funcName: "beginNew",
          arguments: [{ body: "", isPlainText: true }],
          throws: true,
        },
        {
          // HTML and isPlainText. Invalid.
          funcName: "beginNew",
          arguments: [{ plainTextBody: "", isPlainText: false }],
          throws: true,
        },
        {
          // Edit as new.
          funcName: "beginNew",
          arguments: [messages[0].id],
          expected: {
            isHTML: true,
            htmlIncludes: message0body.trim(),
          },
        },
        {
          // Edit as new with plaintext identity
          funcName: "beginNew",
          arguments: [messages[0].id, { identityId: plainTextIdentity.id }],
          expected: {
            isHTML: false,
            plainTextIs: message0body,
          },
        },
        {
          // Edit as new with default identity enforcing HTML
          funcName: "beginNew",
          arguments: [messages[0].id, { isPlainText: false }],
          expected: {
            isHTML: true,
            htmlIncludes: message0body.trim(),
          },
        },
        {
          // Edit as new with plaintext identity enforcing HTML by setting a body.
          funcName: "beginNew",
          arguments: [
            messages[0].id,
            {
              body: "<p>This is some HTML text</p>",
              identityId: plainTextIdentity.id,
            },
          ],
          expected: {
            isHTML: true,
            htmlIncludes: "<p>This is some HTML text</p>",
          },
        },
        {
          // Edit as new with html identity enforcing plain text by setting a plainTextBody.
          funcName: "beginNew",
          arguments: [
            messages[0].id,
            {
              plainTextBody: "This is some plain text",
              identityId: htmlIdentity.id,
            },
          ],
          expected: {
            isHTML: false,
            plainText: "This is some plain text",
          },
        },
        {
          // ForwardInline with plaintext identity enforcing HTML
          funcName: "beginForward",
          arguments: [
            messages[0].id,
            { identityId: plainTextIdentity.id, isPlainText: false },
          ],
          expected: {
            isHTML: true,
            htmlIncludes: message0body.trim(),
          },
        },
        {
          // Reply.
          funcName: "beginReply",
          arguments: [messages[0].id],
          expected: {
            isHTML: true,
            htmlIncludes: message0body.trim(),
          },
        },
        {
          // Forward inline.
          funcName: "beginForward",
          arguments: [messages[0].id],
          expected: {
            isHTML: true,
            htmlIncludes: message0body.trim(),
          },
        },
        {
          // Forward as attachment.
          funcName: "beginForward",
          arguments: [messages[0].id, "forwardAsAttachment"],
          expected: {
            isHTML: true,
            htmlIncludes: emptyHTML,
            plainText: "",
          },
        },
      ];

      for (let test of tests) {
        browser.test.log(JSON.stringify(test));
        let createdWindowPromise = window.waitForEvent("windows.onCreated");
        try {
          await browser.compose[test.funcName](...test.arguments);
          if (test.throws) {
            browser.test.fail(
              "calling beginNew with these arguments should throw"
            );
          }
        } catch (ex) {
          if (test.throws) {
            browser.test.succeed("expected exception thrown");
          } else {
            browser.test.fail(`unexpected exception thrown: ${ex.message}`);
          }
          continue;
        }

        let [createdWindow] = await createdWindowPromise;
        browser.test.assertEq("messageCompose", createdWindow.type);
        browser.test.sendMessage("checkBody", test.expected);
        await window.waitForMessage();
        let removedWindowPromise = window.waitForEvent("windows.onRemoved");
        browser.windows.remove(createdWindow.id);
        await removedWindowPromise;
      }

      browser.test.notifyPass("finished");
    },
    "utils.js": await getUtilsJS(),
  };
  let extension = ExtensionTestUtils.loadExtension({
    files,
    manifest: {
      background: { scripts: ["utils.js", "background.js"] },
      permissions: ["accountsRead", "messagesRead"],
    },
  });
  extension.onMessage("checkBody", async expected => {
    let composeWindows = [...Services.wm.getEnumerator("msgcompose")];
    is(composeWindows.length, 1);
    await new Promise(resolve => composeWindows[0].setTimeout(resolve));

    is(composeWindows[0].IsHTMLEditor(), expected.isHTML, "composition mode");

    let editor = composeWindows[0].GetCurrentEditor();
    // Get the actual message body. Fold Windows line-endings \r\n to \n.
    let actualHTML = editor.outputToString("text/html", 0).replace(/\r/g, "");
    let actualPlainText = editor
      .outputToString("text/plain", 0)
      .replace(/\r/g, "");
    if ("htmlIncludes" in expected) {
      info(actualHTML);
      ok(
        actualHTML.includes(expected.htmlIncludes.replace(/\r/g, "")),
        "HTML content is correct"
      );
    }
    if ("plainTextIs" in expected) {
      is(
        actualPlainText,
        expected.plainTextIs.replace(/\r/g, ""),
        "plainText content is correct"
      );
    }

    extension.sendMessage();
  });

  await extension.startup();
  await extension.awaitFinish("finished");
  await extension.unload();
});

add_task(async function testAttachments() {
  let extension = ExtensionTestUtils.loadExtension({
    background: async () => {
      let [account] = await browser.accounts.list();
      let folder = account.folders.find(f => f.name == "test");
      let { messages } = await browser.messages.list(folder);

      let newTab = await browser.compose.beginNew({
        attachments: [
          { file: new File(["one"], "attachment1.txt") },
          { file: new File(["two"], "attachment-två.txt") },
        ],
      });

      let attachments = await browser.compose.listAttachments(newTab.id);
      browser.test.assertEq(2, attachments.length);
      browser.test.assertEq("attachment1.txt", attachments[0].name);
      browser.test.assertEq("attachment-två.txt", attachments[1].name);

      let replyTab = await browser.compose.beginReply(messages[0].id, {
        attachments: [
          { file: new File(["three"], "attachment3.txt") },
          { file: new File(["four"], "attachment4.txt") },
        ],
      });

      attachments = await browser.compose.listAttachments(replyTab.id);
      browser.test.assertEq(2, attachments.length);
      browser.test.assertEq("attachment3.txt", attachments[0].name);
      browser.test.assertEq("attachment4.txt", attachments[1].name);

      let forwardTab = await browser.compose.beginForward(
        messages[1].id,
        "forwardAsAttachment",
        {
          attachments: [
            { file: new File(["five"], "attachment5.txt") },
            { file: new File(["six"], "attachment6.txt") },
          ],
        }
      );

      attachments = await browser.compose.listAttachments(forwardTab.id);
      browser.test.assertEq(3, attachments.length);
      browser.test.assertEq("attachment5.txt", attachments[0].name);
      browser.test.assertEq("attachment6.txt", attachments[1].name);
      // This is the forwarded email. It really should be the first attachment,
      // but it isn't.
      browser.test.assertEq(`${messages[1].subject}.eml`, attachments[2].name);

      // Forward inline adds attachments differently, so check it works too.

      let forwardTab2 = await browser.compose.beginForward(
        messages[2].id,
        "forwardInline",
        {
          attachments: [
            { file: new File(["seven"], "attachment7.txt") },
            { file: new File(["eight"], "attachment-åtta.txt") },
          ],
        }
      );

      attachments = await browser.compose.listAttachments(forwardTab2.id);
      browser.test.assertEq(2, attachments.length);
      browser.test.assertEq("attachment7.txt", attachments[0].name);
      browser.test.assertEq("attachment-åtta.txt", attachments[1].name);

      let newTab2 = await browser.compose.beginNew(messages[3].id, {
        attachments: [
          { file: new File(["nine"], "attachment9.txt") },
          { file: new File(["ten"], "attachment10.txt") },
        ],
      });

      attachments = await browser.compose.listAttachments(newTab2.id);
      browser.test.assertEq(2, attachments.length);
      browser.test.assertEq("attachment9.txt", attachments[0].name);
      browser.test.assertEq("attachment10.txt", attachments[1].name);

      await browser.tabs.remove(newTab.id);
      await browser.tabs.remove(replyTab.id);
      await browser.tabs.remove(forwardTab.id);
      await browser.tabs.remove(forwardTab2.id);
      await browser.tabs.remove(newTab2.id);

      browser.test.notifyPass();
    },
    manifest: {
      permissions: ["accountsRead", "messagesRead"],
    },
  });

  await extension.startup();
  await extension.awaitFinish();
  await extension.unload();
});
