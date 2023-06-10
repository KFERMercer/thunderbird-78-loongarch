/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

ChromeUtils.defineModuleGetter(
  this,
  "ToolbarButtonAPI",
  "resource:///modules/ExtensionToolbarButtons.jsm"
);

const messageDisplayActionMap = new WeakMap();

this.messageDisplayAction = class extends ToolbarButtonAPI {
  static for(extension) {
    return messageDisplayActionMap.get(extension);
  }

  async onManifestEntry(entryName) {
    await super.onManifestEntry(entryName);
    messageDisplayActionMap.set(this.extension, this);
  }

  close() {
    super.close();
    messageDisplayActionMap.delete(this.extension);
    windowTracker.removeListener("TabSelect", this);
  }

  constructor(extension) {
    super(extension, global);
    this.manifest_name = "message_display_action";
    this.manifestName = "messageDisplayAction";
    this.windowURLs = [
      "chrome://messenger/content/messenger.xhtml",
      "chrome://messenger/content/messageWindow.xhtml",
    ];
    this.toolboxId = "header-view-toolbox";
    this.toolbarId = "header-view-toolbar";

    windowTracker.addListener("TabSelect", this);
  }

  makeButton(window) {
    let button = super.makeButton(window);
    button.classList.add("msgHeaderView-button");
    button.style.listStyleImage = "var(--webextension-menupanel-image)";
    return button;
  }
};

global.messageDisplayActionFor = this.messageDisplayAction.for;
