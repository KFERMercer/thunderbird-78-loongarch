/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* globals gFolderDisplay, gFolderTreeView, MsgOpenNewWindowForMessage, MsgOpenSelectedMessages  */

let account;

add_task(async () => {
  account = createAccount();
  let rootFolder = account.incomingServer.rootFolder;
  let subFolders = [...rootFolder.subFolders];
  createMessages(subFolders[0], 10);

  gFolderTreeView.selectFolder(subFolders[0]);
  gFolderDisplay.selectViewIndex(0);
});

add_task(async () => {
  async function test_it(extension, win) {
    let doc = win.document;

    await extension.startup();
    await promiseAnimationFrame(win);
    await new Promise(resolve => win.setTimeout(resolve));

    let buttonId = "test1_mochi_test-messageDisplayAction-toolbarbutton";
    let toolbar = doc.getElementById("header-view-toolbar");

    let button = doc.getElementById(buttonId);
    ok(button, "Button created");
    is(toolbar.id, button.parentNode.id, "Button added to toolbar");
    ok(
      toolbar.currentSet.split(",").includes(buttonId),
      "Button added to toolbar current set"
    );
    ok(
      toolbar
        .getAttribute("currentset")
        .split(",")
        .includes(buttonId),
      "Button added to toolbar current set attribute"
    );

    let icon = button.querySelector(".toolbarbutton-icon");
    is(
      getComputedStyle(icon).listStyleImage,
      `url("chrome://messenger/content/extension.svg")`,
      "Default icon"
    );
    let label = button.querySelector(".toolbarbutton-text");
    is(label.value, "This is a test", "Correct label");

    EventUtils.synthesizeMouseAtCenter(button, { clickCount: 1 }, win);
    await extension.awaitMessage("messageDisplayAction");
    await promiseAnimationFrame(win);
    await new Promise(resolve => win.setTimeout(resolve));

    is(doc.getElementById(buttonId), button);
    label = button.querySelector(".toolbarbutton-text");
    is(label.value, "New title", "Correct label");

    await extension.unload();
    await promiseAnimationFrame(win);
    await new Promise(resolve => win.setTimeout(resolve));

    ok(!doc.getElementById(buttonId), "Button destroyed");
  }

  async function background_nopopup() {
    browser.messageDisplayAction.onClicked.addListener(async (tab, info) => {
      browser.test.assertEq("object", typeof tab);
      browser.test.assertEq("object", typeof info);
      browser.test.assertEq(0, info.button);
      browser.test.assertTrue(Array.isArray(info.modifiers));
      browser.test.assertEq(0, info.modifiers.length);
      browser.test.log(`Tab ID is ${tab.id}`);
      await browser.messageDisplayAction.setTitle({ title: "New title" });
      browser.test.sendMessage("messageDisplayAction");
    });
  }

  async function background_popup() {
    browser.runtime.onMessage.addListener(async msg => {
      browser.test.assertEq("popup.html", msg);
      await browser.messageDisplayAction.setTitle({ title: "New title" });
      browser.test.sendMessage("messageDisplayAction");
    });
  }

  let extensionDetails = {
    background: background_nopopup,
    files: {
      "popup.html": `<html>
          <head>
            <meta charset="utf-8">
            <script src="popup.js"></script>
          </head>
          <body>popup.js</body>
        </html>`,
      "popup.js": function() {
        window.onload = async () => {
          // eslint-disable-next-line mozilla/no-arbitrary-setTimeout
          await new Promise(resolve => setTimeout(resolve, 1000));
          await browser.runtime.sendMessage("popup.html");
          window.close();
        };
      },
    },
    manifest: {
      applications: {
        gecko: {
          id: "test1@mochi.test",
        },
      },
      message_display_action: {
        default_title: "This is a test",
      },
    },
    useAddonManager: "temporary",
  };

  info("3-pane tab, no pop-up");

  let extension = ExtensionTestUtils.loadExtension(extensionDetails);
  await test_it(extension, window);

  info("Message tab, no pop-up");

  extension = ExtensionTestUtils.loadExtension(extensionDetails);
  MsgOpenSelectedMessages();
  await test_it(extension, window);
  document.getElementById("tabmail").closeTab();

  info("Message window, no pop-up");

  extension = ExtensionTestUtils.loadExtension(extensionDetails);
  let messageWindowPromise = BrowserTestUtils.domWindowOpened();
  MsgOpenNewWindowForMessage();
  let messageWindow = await messageWindowPromise;
  await new Promise(resolve => messageWindow.setTimeout(resolve));
  await new Promise(resolve => messageWindow.setTimeout(resolve));
  await test_it(extension, messageWindow);
  messageWindow.close();

  info("3-pane tab, with pop-up");

  extensionDetails.background = background_popup;
  extensionDetails.manifest.message_display_action.default_popup = "popup.html";
  extension = ExtensionTestUtils.loadExtension(extensionDetails);
  await test_it(extension, window);

  info("Message tab, with pop-up");

  extension = ExtensionTestUtils.loadExtension(extensionDetails);
  MsgOpenSelectedMessages();
  await test_it(extension, window);
  document.getElementById("tabmail").closeTab();

  info("Message window, with pop-up");

  extension = ExtensionTestUtils.loadExtension(extensionDetails);
  messageWindowPromise = BrowserTestUtils.domWindowOpened();
  MsgOpenNewWindowForMessage();
  messageWindow = await messageWindowPromise;
  await new Promise(resolve => messageWindow.setTimeout(resolve));
  await new Promise(resolve => messageWindow.setTimeout(resolve));
  await test_it(extension, messageWindow);
  messageWindow.close();
});
