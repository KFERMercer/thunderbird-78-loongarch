/* -*- Mode: Javascript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

/* import-globals-from preferences.js */
/* import-globals-from subdialogs.js */

var { InlineSpellChecker } = ChromeUtils.import(
  "resource://gre/modules/InlineSpellChecker.jsm"
);

// CloudFile account tools used by gCloudFile.
var { cloudFileAccounts } = ChromeUtils.import(
  "resource:///modules/cloudFileAccounts.jsm"
);
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

Preferences.addAll([
  { id: "mail.forward_message_mode", type: "int" },
  { id: "mail.forward_add_extension", type: "bool" },
  { id: "mail.SpellCheckBeforeSend", type: "bool" },
  { id: "mail.spellcheck.inline", type: "bool" },
  { id: "mail.warn_on_send_accel_key", type: "bool" },
  { id: "mail.compose.autosave", type: "bool" },
  { id: "mail.compose.autosaveinterval", type: "int" },
  { id: "mail.enable_autocomplete", type: "bool" },
  { id: "ldap_2.autoComplete.useDirectory", type: "bool" },
  { id: "ldap_2.autoComplete.directoryServer", type: "string" },
  { id: "pref.ldap.disable_button.edit_directories", type: "bool" },
  { id: "mail.collect_email_address_outgoing", type: "bool" },
  { id: "mail.collect_addressbook", type: "string" },
  { id: "spellchecker.dictionary", type: "unichar" },
  { id: "msgcompose.default_colors", type: "bool" },
  { id: "msgcompose.font_face", type: "string" },
  { id: "msgcompose.font_size", type: "string" },
  { id: "msgcompose.text_color", type: "string" },
  { id: "msgcompose.background_color", type: "string" },
  { id: "mail.compose.attachment_reminder", type: "bool" },
  { id: "mail.compose.default_to_paragraph", type: "bool" },
  { id: "mail.compose.big_attachments.notify", type: "bool" },
  { id: "mail.compose.big_attachments.threshold_kb", type: "int" },
]);

var gComposePane = {
  mSpellChecker: null,
  mDictCount: 0,

  init() {
    this.enableAutocomplete();

    this.initLanguageMenu();

    this.populateFonts();

    this.updateAutosave();

    this.updateUseReaderDefaults();

    this.updateAttachmentCheck();

    this.updateEmailCollection();

    this.initAbDefaultStartupDir();

    this.setButtonColors();

    // If BigFiles is disabled, hide the "Outgoing" tab, and the tab
    // selectors, and bail out.
    if (!Services.prefs.getBoolPref("mail.cloud_files.enabled")) {
      // Hide the tab selector
      let cloudFileBox = document.getElementById("cloudFileBox");
      cloudFileBox.hidden = true;
      return;
    }

    gCloudFile.init();
  },

  sendOptionsDialog() {
    gSubDialog.open("chrome://messenger/content/preferences/sendoptions.xhtml");
  },

  attachmentReminderOptionsDialog() {
    gSubDialog.open(
      "chrome://messenger/content/preferences/attachmentReminder.xhtml",
      "resizable=no"
    );
  },

  updateAutosave() {
    gComposePane.enableElement(
      document.getElementById("autoSaveInterval"),
      Preferences.get("mail.compose.autosave").value
    );
  },

  updateUseReaderDefaults() {
    let useReaderDefaultsChecked = Preferences.get("msgcompose.default_colors")
      .value;
    gComposePane.enableElement(
      document.getElementById("textColorLabel"),
      !useReaderDefaultsChecked
    );
    gComposePane.enableElement(
      document.getElementById("backgroundColorLabel"),
      !useReaderDefaultsChecked
    );
    gComposePane.enableElement(
      document.getElementById("textColorButton"),
      !useReaderDefaultsChecked
    );
    gComposePane.enableElement(
      document.getElementById("backgroundColorButton"),
      !useReaderDefaultsChecked
    );
  },

  updateAttachmentCheck() {
    gComposePane.enableElement(
      document.getElementById("attachment_reminder_button"),
      Preferences.get("mail.compose.attachment_reminder").value
    );
  },

  updateEmailCollection() {
    gComposePane.enableElement(
      document.getElementById("localDirectoriesList"),
      Preferences.get("mail.collect_email_address_outgoing").value
    );
  },

  enableElement(aElement, aEnable) {
    let pref = aElement.getAttribute("preference");
    let prefIsLocked = pref ? Preferences.get(pref).locked : false;
    aElement.disabled = !aEnable || prefIsLocked;
  },

  enableAutocomplete() {
    let acLDAPPref = Preferences.get("ldap_2.autoComplete.useDirectory").value;
    gComposePane.enableElement(
      document.getElementById("directoriesList"),
      acLDAPPref
    );
    gComposePane.enableElement(
      document.getElementById("editButton"),
      acLDAPPref
    );
  },

  editDirectories() {
    gSubDialog.open(
      "chrome://messenger/content/addressbook/pref-editdirectories.xhtml"
    );
  },

  initAbDefaultStartupDir() {
    if (!this.startupDirListener.inited) {
      this.startupDirListener.load();
    }

    let dirList = document.getElementById("defaultStartupDirList");
    if (Services.prefs.getBoolPref("mail.addr_book.view.startupURIisDefault")) {
      // Some directory is the default.
      let startupURI = Services.prefs.getCharPref(
        "mail.addr_book.view.startupURI"
      );
      dirList.value = startupURI;
    } else {
      // Choose item meaning there is no default startup directory any more.
      dirList.value = "";
    }
  },

  setButtonColors() {
    document.getElementById("textColorButton").value = Preferences.get(
      "msgcompose.text_color"
    ).value;
    document.getElementById("backgroundColorButton").value = Preferences.get(
      "msgcompose.background_color"
    ).value;
  },

  setDefaultStartupDir(aDirURI) {
    if (aDirURI) {
      // Some AB directory was selected. Set prefs to make this directory
      // the default view when starting up the main AB.
      Services.prefs.setCharPref("mail.addr_book.view.startupURI", aDirURI);
      Services.prefs.setBoolPref(
        "mail.addr_book.view.startupURIisDefault",
        true
      );
    } else {
      // Set pref that there's no default startup view directory any more.
      Services.prefs.setBoolPref(
        "mail.addr_book.view.startupURIisDefault",
        false
      );
    }
  },

  initLanguageMenu() {
    var languageMenuList = document.getElementById("languageMenuList");
    this.mSpellChecker = Cc["@mozilla.org/spellchecker/engine;1"].getService(
      Ci.mozISpellCheckingEngine
    );

    // Get the list of dictionaries from
    // the spellchecker.

    var dictList = this.mSpellChecker.getDictionaryList();
    var count = dictList.length;

    // if we don't have any dictionaries installed, disable the menu list
    languageMenuList.disabled = !count;

    // If dictionary count hasn't changed then no need to update the menu.
    if (this.mDictCount == count) {
      return;
    }

    // Store current dictionary count.
    this.mDictCount = count;

    var inlineSpellChecker = new InlineSpellChecker();
    var sortedList = inlineSpellChecker.sortDictionaryList(dictList);

    // Remove any languages from the list.
    languageMenuList.removeAllItems();

    // append the dictionaries to the menu list...
    for (var i = 0; i < count; i++) {
      languageMenuList.appendItem(
        sortedList[i].displayName,
        sortedList[i].localeCode
      );
    }

    languageMenuList.setInitialSelection();
  },

  populateFonts() {
    var fontsList = document.getElementById("FontSelect");
    try {
      var enumerator = Cc["@mozilla.org/gfx/fontenumerator;1"].getService(
        Ci.nsIFontEnumerator
      );
      var localFonts = enumerator.EnumerateAllFonts();
      for (let i = 0; i < localFonts.length; ++i) {
        // Remove Linux system generic fonts that collide with CSS generic fonts.
        if (
          localFonts[i] != "" &&
          localFonts[i] != "serif" &&
          localFonts[i] != "sans-serif" &&
          localFonts[i] != "monospace"
        ) {
          fontsList.appendItem(localFonts[i], localFonts[i]);
        }
      }
    } catch (e) {}
    // Choose the item after the list is completely generated.
    var preference = Preferences.get(fontsList.getAttribute("preference"));
    fontsList.value = preference.value;
  },

  restoreHTMLDefaults() {
    // reset throws an exception if the pref value is already the default so
    // work around that with some try/catch exception handling
    try {
      Preferences.get("msgcompose.font_face").reset();
    } catch (ex) {}

    try {
      Preferences.get("msgcompose.font_size").reset();
    } catch (ex) {}

    try {
      Preferences.get("msgcompose.text_color").reset();
    } catch (ex) {}

    try {
      Preferences.get("msgcompose.background_color").reset();
    } catch (ex) {}

    try {
      Preferences.get("msgcompose.default_colors").reset();
    } catch (ex) {}

    this.updateUseReaderDefaults();
    this.setButtonColors();
  },

  startupDirListener: {
    inited: false,
    domain: "mail.addr_book.view.startupURI",
    observe(subject, topic, prefName) {
      if (topic != "nsPref:changed") {
        return;
      }

      // If the default startup directory prefs have changed,
      // reinitialize the default startup dir picker to show the new value.
      gComposePane.initAbDefaultStartupDir();
    },
    load() {
      // Observe changes of our prefs.
      Services.prefs.addObserver(this.domain, this);
      // Unload the pref observer when preferences window is closed.
      window.addEventListener("unload", () => this.unload(), true);
      this.inited = true;
    },

    unload(event) {
      Services.prefs.removeObserver(
        gComposePane.startupDirListener.domain,
        gComposePane.startupDirListener
      );
    },
  },
};

var gCloudFile = {
  _initialized: false,
  _list: null,
  _buttonContainer: null,
  _listContainer: null,
  _settings: null,
  _settingsDeck: null,
  _tabpanel: null,
  _settingsPanelWrap: null,
  _defaultPanel: null,

  get _strings() {
    return Services.strings.createBundle(
      "chrome://messenger/locale/preferences/applications.properties"
    );
  },

  init() {
    this._list = document.getElementById("cloudFileView");
    this._buttonContainer = document.getElementById(
      "addCloudFileAccountButtons"
    );
    this._addAccountButton = document.getElementById("addCloudFileAccount");
    this._listContainer = document.getElementById(
      "addCloudFileAccountListItems"
    );
    this._removeAccountButton = document.getElementById(
      "removeCloudFileAccount"
    );
    this._settingsDeck = document.getElementById("cloudFileSettingsDeck");
    this._defaultPanel = document.getElementById("cloudFileDefaultPanel");
    this._settingsPanelWrap = document.getElementById(
      "cloudFileSettingsWrapper"
    );

    this.updateThreshold();
    this.rebuildView();

    window.addEventListener("unload", this, { capture: false, once: true });

    this._onAccountConfigured = this._onAccountConfigured.bind(this);
    this._onProviderRegistered = this._onProviderRegistered.bind(this);
    this._onProviderUnregistered = this._onProviderUnregistered.bind(this);
    cloudFileAccounts.on("accountConfigured", this._onAccountConfigured);
    cloudFileAccounts.on("providerRegistered", this._onProviderRegistered);
    cloudFileAccounts.on("providerUnregistered", this._onProviderUnregistered);

    let element = document.getElementById("cloudFileThreshold");
    Preferences.addSyncFromPrefListener(element, () => this.readThreshold());
    Preferences.addSyncToPrefListener(element, () => this.writeThreshold());

    this._initialized = true;
  },

  destroy() {
    // Remove any controllers or observers here.
    cloudFileAccounts.off("accountConfigured", this._onAccountConfigured);
    cloudFileAccounts.off("providerRegistered", this._onProviderRegistered);
    cloudFileAccounts.off("providerUnregistered", this._onProviderUnregistered);
  },

  _onAccountConfigured(event, account) {
    for (let item of this._list.children) {
      if (item.value == account.accountKey) {
        item.querySelector("image.configuredWarning").hidden =
          account.configured;
      }
    }
  },

  _onProviderRegistered(event, provider) {
    let accounts = cloudFileAccounts.getAccountsForType(provider.type);
    accounts.sort(this._sortDisplayNames);

    // Always add newly-enabled accounts to the end of the list, this makes
    // it clearer to users what's happening.
    for (let account of accounts) {
      let item = this.makeRichListItemForAccount(account);
      this._list.appendChild(item);
    }

    this._buttonContainer.appendChild(this.makeButtonForProvider(provider));
    this._listContainer.appendChild(this.makeListItemForProvider(provider));
  },

  _onProviderUnregistered(event, type) {
    for (let item of [...this._list.children]) {
      // If the provider is unregistered, getAccount returns null.
      if (!cloudFileAccounts.getAccount(item.value)) {
        if (item.hasAttribute("selected")) {
          this._settingsDeck.selectedPanel = this._defaultPanel;
          if (this._settings) {
            this._settings.remove();
          }
          this._removeAccountButton.disabled = true;
        }
        item.remove();
      }
    }

    for (let button of this._buttonContainer.children) {
      if (button.getAttribute("value") == type) {
        button.remove();
      }
    }

    for (let item of this._listContainer.children) {
      if (item.getAttribute("value") == type) {
        item.remove();
      }
    }

    if (this._buttonContainer.childElementCount < 1) {
      this._buttonContainer.hidden = false;
      this._addAccountButton.hidden = true;
    }
  },

  makeRichListItemForAccount(aAccount) {
    let rli = document.createXULElement("richlistitem");
    rli.value = aAccount.accountKey;
    rli.setAttribute("align", "center");
    rli.classList.add("cloudfileAccount", "input-container");
    rli.setAttribute("value", aAccount.accountKey);

    if (aAccount.iconURL) {
      rli.style.listStyleImage = "url('" + aAccount.iconURL + "')";
    }

    let icon = document.createXULElement("image");
    icon.setAttribute("class", "typeIcon");
    rli.appendChild(icon);

    let label = document.createXULElement("label");
    label.setAttribute("crop", "end");
    label.setAttribute("flex", "1");
    label.setAttribute(
      "value",
      cloudFileAccounts.getDisplayName(aAccount.accountKey)
    );
    label.addEventListener("click", this, true);
    rli.appendChild(label);

    let input = document.createElement("input");
    input.setAttribute("type", "text");
    input.setAttribute("hidden", "hidden");
    input.addEventListener("blur", this);
    input.addEventListener("keypress", this);
    rli.appendChild(input);

    let warningIcon = document.createXULElement("image");
    warningIcon.setAttribute("class", "configuredWarning typeIcon");
    warningIcon.setAttribute("src", "chrome://global/skin/icons/warning.svg");
    warningIcon.setAttribute(
      "tooltiptext",
      this._strings.GetStringFromName("notConfiguredYet")
    );
    if (aAccount.configured) {
      warningIcon.hidden = true;
    }
    rli.appendChild(warningIcon);

    return rli;
  },

  makeButtonForProvider(provider) {
    let button = document.createXULElement("button");
    button.setAttribute("value", provider.type);
    button.setAttribute(
      "label",
      this._strings.formatStringFromName("addProvider", [provider.displayName])
    );
    button.setAttribute(
      "oncommand",
      `gCloudFile.addCloudFileAccount("${provider.type}")`
    );
    button.style.listStyleImage = `url("${provider.iconURL}")`;
    return button;
  },

  makeListItemForProvider(provider) {
    let menuitem = document.createXULElement("menuitem");
    menuitem.classList.add("menuitem-iconic");
    menuitem.setAttribute("value", provider.type);
    menuitem.setAttribute("label", provider.displayName);
    menuitem.setAttribute("image", provider.iconURL);
    return menuitem;
  },

  // Sort the accounts by displayName.
  _sortDisplayNames(a, b) {
    let aName = a.displayName.toLowerCase();
    let bName = b.displayName.toLowerCase();
    return aName.localeCompare(bName);
  },

  rebuildView() {
    // Clear the list of entries.
    while (this._list.hasChildNodes()) {
      this._list.lastChild.remove();
    }

    let accounts = cloudFileAccounts.accounts;
    accounts.sort(this._sortDisplayNames);

    for (let account of accounts) {
      let rli = this.makeRichListItemForAccount(account);
      this._list.appendChild(rli);
    }

    while (this._buttonContainer.hasChildNodes()) {
      this._buttonContainer.lastChild.remove();
    }

    let providers = cloudFileAccounts.providers;
    providers.sort(this._sortDisplayNames);
    for (let provider of providers) {
      this._buttonContainer.appendChild(this.makeButtonForProvider(provider));
      this._listContainer.appendChild(this.makeListItemForProvider(provider));
    }
  },

  onSelectionChanged(aEvent) {
    if (!this._initialized || aEvent.target != this._list) {
      return;
    }

    // Get the selected item
    let selection = this._list.selectedItem;
    this._removeAccountButton.disabled = !selection;
    if (!selection) {
      this._settingsDeck.selectedPanel = this._defaultPanel;
      if (this._settings) {
        this._settings.remove();
      }
      return;
    }

    this._showAccountInfo(selection.value);
  },

  _showAccountInfo(aAccountKey) {
    let account = cloudFileAccounts.getAccount(aAccountKey);
    this._settingsDeck.selectedPanel = this._settingsPanelWrap;

    let url = account.managementURL + `?accountId=${account.accountKey}`;

    let iframe = document.createXULElement("iframe");
    iframe.setAttribute("flex", "1");
    // allows keeping dialog background color without hoops
    iframe.setAttribute("transparent", "true");

    let type = url.startsWith("chrome:") ? "chrome" : "content";
    iframe.setAttribute("type", type);
    iframe.setAttribute("src", url);

    // If we have a past iframe, we replace it. Else append
    // to the wrapper.
    if (this._settings) {
      this._settings.remove();
    }

    this._settingsPanelWrap.appendChild(iframe);
    this._settings = iframe;
  },

  onListOverflow() {
    if (this._buttonContainer.childElementCount > 1) {
      this._buttonContainer.hidden = true;
      this._addAccountButton.hidden = false;
    }
  },

  addCloudFileAccount(aType) {
    let account = cloudFileAccounts.createAccount(aType);
    if (!account) {
      return;
    }

    let rli = this.makeRichListItemForAccount(account);
    this._list.appendChild(rli);
    this._list.selectItem(rli);
    this._addAccountButton.removeAttribute("image");
    this._addAccountButton.setAttribute(
      "label",
      this._addAccountButton.getAttribute("defaultlabel")
    );
    this._removeAccountButton.disabled = false;
  },

  removeCloudFileAccount() {
    // Get the selected account key
    let selection = this._list.selectedItem;
    if (!selection) {
      return;
    }

    let accountKey = selection.value;
    let accountName = cloudFileAccounts.getDisplayName(accountKey);
    // Does the user really want to remove this account?
    let confirmMessage = this._strings.formatStringFromName(
      "dialog_removeAccount",
      [accountName]
    );

    if (Services.prompt.confirm(null, "", confirmMessage)) {
      this._list.clearSelection();
      cloudFileAccounts.removeAccount(accountKey);
      let rli = this._list.querySelector(
        "richlistitem[value='" + accountKey + "']"
      );
      rli.remove();
      this._settingsDeck.selectedPanel = this._defaultPanel;
      if (this._settings) {
        this._settings.remove();
      }
    }
  },

  handleEvent(aEvent) {
    switch (aEvent.type) {
      case "unload":
        this.destroy();
        break;
      case "click": {
        let label = aEvent.target;
        let item = label.parentNode;
        let input = item.querySelector("input");
        if (!item.selected) {
          return;
        }
        label.hidden = true;
        input.value = label.value;
        input.removeAttribute("hidden");
        input.focus();
        break;
      }
      case "blur": {
        let input = aEvent.target;
        let item = input.parentNode;
        let label = item.querySelector("label");
        cloudFileAccounts.setDisplayName(item.value, input.value);
        label.value = input.value;
        label.hidden = false;
        input.setAttribute("hidden", "hidden");
        break;
      }
      case "keypress": {
        let input = aEvent.target;
        let item = input.parentNode;
        let label = item.querySelector("label");

        if (aEvent.key == "Enter") {
          cloudFileAccounts.setDisplayName(item.value, input.value);
          label.value = input.value;
          label.hidden = false;
          input.setAttribute("hidden", "hidden");
          gCloudFile._list.focus();

          aEvent.preventDefault();
        } else if (aEvent.key == "Escape") {
          input.value = label.value;
          label.hidden = false;
          input.setAttribute("hidden", "hidden");
          gCloudFile._list.focus();

          aEvent.preventDefault();
        }
      }
    }
  },

  readThreshold() {
    let pref = Preferences.get("mail.compose.big_attachments.threshold_kb");
    return pref.value / 1024;
  },

  writeThreshold() {
    let threshold = document.getElementById("cloudFileThreshold");
    let intValue = parseInt(threshold.value, 10);
    return isNaN(intValue) ? 0 : intValue * 1024;
  },

  updateThreshold() {
    document.getElementById("cloudFileThreshold").disabled = !Preferences.get(
      "mail.compose.big_attachments.notify"
    ).value;
  },
};

Preferences.get("mail.compose.autosave").on(
  "change",
  gComposePane.updateAutosave
);
Preferences.get("mail.compose.attachment_reminder").on(
  "change",
  gComposePane.updateAttachmentCheck
);
Preferences.get("msgcompose.default_colors").on(
  "change",
  gComposePane.updateUseReaderDefaults
);
Preferences.get("ldap_2.autoComplete.useDirectory").on(
  "change",
  gComposePane.enableAutocomplete
);
Preferences.get("mail.collect_email_address_outgoing").on(
  "change",
  gComposePane.updateEmailCollection
);
Preferences.get("mail.compose.big_attachments.notify").on(
  "change",
  gCloudFile.updateThreshold
);
