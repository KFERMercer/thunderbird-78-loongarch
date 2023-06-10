/* -*- Mode: Javascript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* import-globals-from MsgComposeCommands.js */

var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { MimeParser } = ChromeUtils.import("resource:///modules/mimeParser.jsm");
var { DisplayNameUtils } = ChromeUtils.import(
  "resource:///modules/DisplayNameUtils.jsm"
);
var gDragService = Cc["@mozilla.org/widget/dragservice;1"].getService(
  Ci.nsIDragService
);

/**
 * Convert all the written recipients into string and store them into the
 * msgCompFields array to be printed in the message header.
 *
 * @param {Object} msgCompFields - An object to receive the recipients.
 */
function Recipients2CompFields(msgCompFields) {
  if (!msgCompFields) {
    throw new Error(
      "Message Compose Error: msgCompFields is null (ExtractRecipients)"
    );
  }

  let addrTo = "";
  let addrCc = "";
  let addrBcc = "";
  let addrReply = "";
  let addrNg = "";
  let addrFollow = "";
  let to_Sep = "";
  let cc_Sep = "";
  let bcc_Sep = "";
  let reply_Sep = "";
  let ng_Sep = "";
  let follow_Sep = "";

  for (let pill of document.getElementsByTagName("mail-address-pill")) {
    let fieldValue = pill.fullAddress;
    let headerParser = MailServices.headerParser;
    let recipient = headerParser
      .makeFromDisplayAddress(fieldValue)
      .map(fullValue =>
        headerParser.makeMimeAddress(fullValue.name, fullValue.email)
      )
      .join(", ");

    // Each pill knows from which recipient they were generated
    // (addr_to, addrs_bcc, etc.).
    let recipientType = pill.getAttribute("recipienttype");
    switch (recipientType) {
      case "addr_to":
        addrTo += to_Sep + recipient;
        to_Sep = ",";
        break;
      case "addr_cc":
        addrCc += cc_Sep + recipient;
        cc_Sep = ",";
        break;
      case "addr_bcc":
        addrBcc += bcc_Sep + recipient;
        bcc_Sep = ",";
        break;
      case "addr_reply":
        addrReply += reply_Sep + recipient;
        reply_Sep = ",";
        break;
      case "addr_newsgroups":
        addrNg += ng_Sep + recipient;
        ng_Sep = ",";
        break;
      case "addr_followup":
        addrFollow += follow_Sep + recipient;
        follow_Sep = ",";
        break;
    }
  }

  for (let otherHeaderRow of document.querySelectorAll(
    ".address-row[data-labeltype=addr_other]"
  )) {
    let headerValue = otherHeaderRow.querySelector("input").value.trim();
    if (headerValue) {
      msgCompFields.setRawHeader(otherHeaderRow.dataset.labelid, headerValue);
    }
  }

  msgCompFields.to = addrTo;
  msgCompFields.cc = addrCc;
  msgCompFields.bcc = addrBcc;
  msgCompFields.replyTo = addrReply;
  msgCompFields.newsgroups = addrNg;
  msgCompFields.followupTo = addrFollow;
}

/**
 * Convert all the recipients coming from a message header into pills.
 *
 * @param {Object} msgCompFields - An object containing all the recipients. If
 *                                 any property is not a string, it is ignored.
 */
function CompFields2Recipients(msgCompFields) {
  if (msgCompFields) {
    // Populate all the recipients with the proper values.
    // We need to force the focus() on each input to trigger the attachment
    // of the autocomplete mController.
    if (typeof msgCompFields.replyTo == "string") {
      let input = document.getElementById("replyAddrInput");
      recipientClearPills(input);

      let msgReplyTo = MailServices.headerParser.parseEncodedHeaderW(
        msgCompFields.replyTo
      );
      if (msgReplyTo.length) {
        showAddressRow(
          document.getElementById("addr_reply"),
          "addressRowReply"
        );
        input.focus();
        input.value = msgReplyTo.join(", ");
        recipientAddPills(input, true);
      }
    }

    if (typeof msgCompFields.to == "string") {
      let input = document.getElementById("toAddrInput");
      recipientClearPills(input);

      let msgTo = MailServices.headerParser.parseEncodedHeaderW(
        msgCompFields.to
      );
      if (msgTo.length) {
        if (input.closest(".address-row").classList.contains("hidden")) {
          showAddressRow(document.getElementById("addr_to"), "addressRowTo");
        }
        input.focus();
        input.value = msgTo.join(", ");
        recipientAddPills(input, true);
      }
    }

    if (typeof msgCompFields.cc == "string") {
      let input = document.getElementById("ccAddrInput");
      recipientClearPills(input);

      let msgCC = MailServices.headerParser.parseEncodedHeaderW(
        msgCompFields.cc
      );
      if (msgCC.length) {
        showAddressRow(document.getElementById("addr_cc"), "addressRowCc");
        input.focus();
        input.value = msgCC.join(", ");
        recipientAddPills(input, true);
      }
    }

    if (typeof msgCompFields.bcc == "string") {
      let input = document.getElementById("bccAddrInput");
      recipientClearPills(input);

      let msgBCC = MailServices.headerParser.parseEncodedHeaderW(
        msgCompFields.bcc
      );
      if (msgBCC.length) {
        showAddressRow(document.getElementById("addr_bcc"), "addressRowBcc");
        input.focus();
        input.value = msgBCC.join(", ");
        recipientAddPills(input, true);
      }
    }

    if (typeof msgCompFields.newsgroups == "string") {
      let input = document.getElementById("newsgroupsAddrInput");
      recipientClearPills(input);

      if (msgCompFields.newsgroups) {
        showAddressRow(
          document.getElementById("addr_newsgroups"),
          "addressRowNewsgroups"
        );
        input.focus();
        input.value = msgCompFields.newsgroups;
        recipientAddPills(input, true);
      }
    }

    if (typeof msgCompFields.followupTo == "string") {
      let input = document.getElementById("followupAddrInput");
      recipientClearPills(input);

      let msgFollowupTo = MailServices.headerParser.parseEncodedHeaderW(
        msgCompFields.followupTo
      );
      if (msgFollowupTo.length) {
        showAddressRow(
          document.getElementById("addr_followup"),
          "addressRowFollowup"
        );
        input.focus();
        input.value = msgFollowupTo.join(", ");
        recipientAddPills(input, true);
      }
    }

    // Add the sender to our spell check ignore list.
    if (gCurrentIdentity) {
      addRecipientsToIgnoreList(gCurrentIdentity.fullAddress);
    }

    // Trigger this method only after all the pills have been created.
    onRecipientsChanged(true);
  }
}

/**
 * Update the recipients area UI to show News related fields and hide
 * Mail related fields.
 */
function updateUIforNNTPAccount() {
  // Hide the `mail-primary-input` field row if no pills have been created.
  let mailContainer = document
    .querySelector(".mail-primary-input")
    .closest(".address-container");
  if (mailContainer.querySelectorAll("mail-address-pill").length == 0) {
    mailContainer
      .closest(".address-row")
      .querySelector(".aw-firstColBox > label")
      .click();
  }

  // Show the closing label.
  mailContainer
    .closest(".address-row")
    .querySelector(".aw-firstColBox > label")
    .removeAttribute("collapsed");

  // Show the `news-primary-input` field row if not already visible.
  let newsContainer = document
    .querySelector(".news-primary-input")
    .closest(".address-row");
  if (newsContainer.classList.contains("hidden")) {
    document.querySelector(".news-primary-label").click();
  } else {
    document
      .querySelector(".news-primary-label")
      .setAttribute("collapsed", "true");
  }

  // Hide the closing label.
  newsContainer
    .querySelector(".aw-firstColBox > label")
    .setAttribute("collapsed", "true");

  // Reorder `mail-label` menu items.
  let panel = document.getElementById("extraRecipientsPanel");
  for (let label of document.querySelectorAll(".mail-label")) {
    panel.appendChild(label);
  }

  // Reorder `news-label` menu items.
  let extraRecipients = document.querySelector(".address-extra-recipients");
  for (let label of document.querySelectorAll(".news-label")) {
    extraRecipients.prepend(label);
  }
}

/**
 * Update the recipients area UI to show Mail related fields and hide
 * News related fields. This method is called only if the UI was previously
 * updated to accommodate a News account type.
 */
function updateUIforMailAccount() {
  // Show the `mail-primary-input` field row if not already visible.
  let mailContainer = document
    .querySelector(".mail-primary-input")
    .closest(".address-row");
  if (mailContainer.classList.contains("hidden")) {
    document.querySelector(".mail-primary-label").click();
  }

  // Hide the closing label.
  mailContainer
    .querySelector(".aw-firstColBox > label")
    .setAttribute("collapsed", "true");

  // Hide the `news-primary-input` field row if no pills have been created.
  let newsContainer = document
    .querySelector(".news-primary-input")
    .closest(".address-row");
  if (newsContainer.querySelectorAll("mail-address-pill").length == 0) {
    newsContainer.querySelector(".aw-firstColBox > label").click();
  }

  // Show the closing label.
  newsContainer
    .querySelector(".aw-firstColBox > label")
    .removeAttribute("collapsed");

  // Reorder `mail-label` menu items.
  let panel = document.getElementById("extraRecipientsPanel");
  for (let label of document.querySelectorAll(".news-label")) {
    panel.appendChild(label);
  }

  // Reorder `news-label` menu items.
  let extraRecipients = document.getElementById(
    "addressingWidgetSwappableLabels"
  );
  for (let label of document.querySelectorAll(".mail-label")) {
    extraRecipients.appendChild(label);
  }
}

/**
 * Remove recipient pills from a specific addressing field based on full address
 * matching. This is commonly used to clear previous Auto-CC/BCC recipients when
 * loading a new identity.
 *
 * @param {Object} msgCompFields - gMsgCompose.compFields, for helper functions.
 * @param {string} recipientType - The type of recipients to remove,
 *   e.g. "addr_to" (recipient label id).
 * @param {string} recipientsList - Comma-separated string containing recipients
 *   to be removed. May contain display names, and other commas therein. We only
 *   remove first exact match (full address).
 */
function awRemoveRecipients(msgCompFields, recipientType, recipientsList) {
  if (!recipientType || !recipientsList) {
    return;
  }

  let container;
  switch (recipientType) {
    case "addr_cc":
      container = document.getElementById("ccAddrContainer");
      break;
    case "addr_bcc":
      container = document.getElementById("bccAddrContainer");
      break;
    case "addr_reply":
      container = document.getElementById("replyAddrContainer");
      break;
    case "addr_to":
      container = document.getElementById("toAddrContainer");
      break;
  }

  // Convert csv string of recipients to be deleted into full addresses array.
  let recipientsArray = msgCompFields.splitRecipients(recipientsList, false);

  // Remove first instance of specified recipients from specified container.
  for (let recipientFullAddress of recipientsArray) {
    let pill = container.querySelector(
      `mail-address-pill[fullAddress="${recipientFullAddress}"]`
    );
    if (pill) {
      pill.remove();
    }
  }

  let addressRow = container.closest(`.address-row`);

  // Remove entire address row if empty, no user input, and not type "addr_to".
  if (
    recipientType != "addr_to" &&
    !container.querySelector(`mail-address-pill`) &&
    !container.querySelector(`input[is="autocomplete-input"]`).value
  ) {
    addressRow.classList.add("hidden");
    document.getElementById(recipientType).removeAttribute("collapsed");
  }

  udpateAriaLabelsOfAddressRow(addressRow);
}

/**
 * Adds a batch of new rows matching recipientType and drops in the list of addresses.
 *
 * @param msgCompFields  A nsIMsgCompFields object that is only used as a helper,
 *                       it will not get the addresses appended.
 * @param recipientType  Type of recipient, e.g. "addr_to".
 * @param recipientList  A string of addresses to add.
 */
function awAddRecipients(msgCompFields, recipientType, recipientsList) {
  if (!msgCompFields || !recipientsList) {
    return;
  }

  awAddRecipientsArray(
    recipientType,
    msgCompFields.splitRecipients(recipientsList, false)
  );
}

/**
 * Adds a batch of new recipient pill matching recipientType
 * and drops in the array of addresses.
 *
 * @param {string} aRecipientType - Type of recipient, e.g. "addr_to".
 * @param {string[]} aAddressArray - Recipient addresses (strings) to add.
 * @param {boolean=false} select - If the newly generated pills should be selected.
 */
function awAddRecipientsArray(aRecipientType, aAddressArray, select = false) {
  let label = document.getElementById(aRecipientType);
  let addresses = MailServices.headerParser.makeFromDisplayAddress(
    aAddressArray
  );
  let element = document.getElementById(label.getAttribute("control"));

  if (label && element.closest(".address-row").classList.contains("hidden")) {
    label.click();
  }

  let recipientArea = document.getElementById("recipientsContainer");
  for (let address of addresses) {
    let pill = recipientArea.createRecipientPill(element, address);
    if (select) {
      pill.setAttribute("selected", "selected");
    }
  }

  element
    .closest(".address-container")
    .classList.add("addressing-field-edited");

  // Add the recipients to our spell check ignore list.
  addRecipientsToIgnoreList(aAddressArray.join(", "));
  calculateHeaderHeight();
  udpateAriaLabelsOfAddressRow(element.closest(".address-row"));

  if (element.id != "replyAddrInput") {
    onRecipientsChanged();
  }
}

function DragOverAddressingWidget(event) {
  let dragSession = (dragSession = gDragService.getCurrentSession());

  if (dragSession.isDataFlavorSupported("text/x-moz-address")) {
    dragSession.canDrop = true;
  }
}

function DropOnAddressingWidget(event) {
  let dragSession = gDragService.getCurrentSession();

  let trans = Cc["@mozilla.org/widget/transferable;1"].createInstance(
    Ci.nsITransferable
  );
  trans.init(getLoadContext());
  trans.addDataFlavor("text/x-moz-address");

  for (let i = 0; i < dragSession.numDropItems; ++i) {
    dragSession.getData(trans, i);
    let dataObj = {};
    let bestFlavor = {};
    trans.getAnyTransferData(bestFlavor, dataObj);
    if (dataObj) {
      dataObj = dataObj.value.QueryInterface(Ci.nsISupportsString);
    }
    if (!dataObj) {
      continue;
    }

    // pull the address out of the data object
    let address = dataObj.data.substring(0, dataObj.length);
    if (!address) {
      continue;
    }

    DropRecipient(event.target, address);
  }
}

/**
 * Find the autocomplete input when an address is dropped in the compose header.
 *
 * @param {XULElement} target - The element where an address was dropped.
 * @param {string} recipient - The email address dragged by the user.
 */
function DropRecipient(target, recipient) {
  let input;

  if (target.tagName == "label" && target.hasAttribute("control")) {
    input = document.getElementById(target.getAttribute("control"));
  } else {
    let container = target.classList.contains("address-row")
      ? target
      : target.closest("hbox.address-row");

    if (!container) {
      return;
    }
    input = container.querySelector(
      `.address-container > input[is="autocomplete-input"]`
    );
  }

  if (!input || !input.hasAttribute("is")) {
    return;
  }

  let recipientType =
    input.getAttribute("recipienttype") != "addr_other"
      ? input.getAttribute("recipienttype")
      : input.getAttribute("aria-labelledby");

  awAddRecipientsArray(recipientType, [recipient]);
}

function awSizerListen() {
  // when splitter is clicked, fill in necessary dummy rows each time
  // the mouse is moved.
  document.addEventListener("mousemove", awSizerMouseMove, true);
  document.addEventListener("mouseup", awSizerMouseUp, {
    capture: false,
    once: true,
  });
}
// Add the overflow scroll attribute to the recipients container.
function awSizerMouseMove() {
  document.getElementById("recipientsContainer").classList.add("overflow");
}

function awSizerMouseUp() {
  document.removeEventListener("mousemove", awSizerMouseMove, true);
}

// Returns the load context for the current window
function getLoadContext() {
  return window.docShell.QueryInterface(Ci.nsILoadContext);
}

/**
 * Handle keydown events for other header input fields in the compose window.
 * Only applies to rows created from mail.compose.other.header pref; no pills.
 * Keep behaviour in sync with addressInputOnBeforeHandleKeyDown().
 *
 * @param {Event} event - The DOM keydown event.
 */
function otherHeaderInputOnKeyDown(event) {
  let input = event.target;

  switch (event.key) {
    case " ":
      // If the existing input value is empty string or whitespace only,
      // prevent entering space and clear whitespace-only input text.
      if (!input.value.trim()) {
        event.preventDefault();
        input.value = "";
      }
      break;
    case "Enter":
      // Move focus to the next available element,
      // but not for Ctrl/Cmd+[Shift]+Enter keyboard shortcuts for sending.
      if (!event.ctrlKey && !event.metaKey) {
        // Prevent Enter from firing again on the element we move the focus to.
        event.preventDefault();
        SetFocusOnNextAvailableElement(input);
      }

      // macOS only variation to prevent the cursor from moving to the next
      // element while sending.
      if (event.metaKey) {
        event.stopPropagation();
      }
      break;
    case "Backspace":
    case "Delete":
      if (
        event.repeat ||
        input.value.trim() ||
        input.selectionStart + input.selectionEnd ||
        input
          .closest(".address-row")
          .querySelector(".aw-firstColBox > label[collapsed]")
      ) {
        // Interrupt if repeated keydown from deleting text, input still has
        // text, or cursor selection is not at position 0 while deleting
        // whitespace, to allow regular text deletion before we remove the row.
        // Also interrupt for non-removable rows with collapsed [x] button.
        break;
      }
      // If "Backspace" or "Delete" was explicitly pressed on an empty row,
      // hide it and focus previous or next row respectively.
      hideAddressRow(input, event.key == "Backspace" ? "previous" : "next");
      break;
  }
}

/**
 * Handle keydown events for autocomplete address inputs in the compose window.
 * Does not apply to rows created from mail.compose.other.header pref, which are
 * handled with a subset of this function in otherHeaderInputOnKeyDown().
 *
 * @param {Event} event - The DOM keydown event.
 */
function addressInputOnBeforeHandleKeyDown(event) {
  let input = event.target;

  switch (event.key) {
    case "a":
      // Select all the pills if the input is empty.
      if ((event.ctrlKey || event.metaKey) && !input.value) {
        // Prevent a pill keypress event when the focus moves on it.
        event.preventDefault();

        let previous = input.previousElementSibling;
        if (previous && previous.tagName == "mail-address-pill") {
          input.closest("mail-recipients-area").selectPills(previous);
          previous.focus();
        }
      }
      break;

    case " ":
      // If the existing input value is empty string or whitespace only,
      // prevent entering space and clear whitespace-only input text.
      if (!input.value.trim()) {
        event.preventDefault();
        input.value = "";
      }
      break;

    case ",":
      let selection = input.value.substring(
        input.selectionStart,
        input.selectionEnd
      );

      // Don't trigger autocomplete if a comma is present as a first character
      // to prevent early pill creation when the autocomplete suggests contacts
      // with commas in the display name, or if the typed value is not a valid
      // address, after the comma or semicolon has been stripped.
      if (
        selection[0] == "," ||
        !isValidAddress(input.value.substring(0, input.selectionEnd))
      ) {
        break;
      }
      event.preventDefault();
      input.handleEnter(event);
      break;

    case "Home":
    case "ArrowLeft":
    case "Backspace":
      if (
        event.repeat ||
        input.value.trim() ||
        input.selectionStart + input.selectionEnd ||
        event.altKey
      ) {
        break;
      }
      // If unrepeated keydown, empty input or whitespace-only, cursor at
      // position 0, and Alt-key not used (prevent Alt+Backspace from deleting
      // pills), navigate into pills. We'll sanitize whitespace on blur.

      // Prevent a pill keypress event when the focus moves on it.
      event.preventDefault();

      let targetPill = input
        .closest(".address-container")
        .querySelector(
          "mail-address-pill" + (event.key == "Home" ? "" : ":last-of-type")
        );
      if (targetPill) {
        input
          .closest("mail-recipients-area")
          .checkKeyboardSelected(event, targetPill);
        break;
      }

      if (
        event.key == "Backspace" &&
        input
          .closest(".address-row")
          .querySelector(".aw-firstColBox > label:not([collapsed])")
      ) {
        // If addressing row has no pills nor text, unrepeated Backspace
        // keydown, and row has an [x] button, hide row and focus previous row.
        hideAddressRow(input, "previous");
      }
      break;

    case "Delete":
      if (
        !event.repeat &&
        !input.value.trim() &&
        !(input.selectionStart + input.selectionEnd) &&
        !input
          .closest(".address-container")
          .querySelector("mail-address-pill") &&
        !input
          .closest(".address-row")
          .querySelector(".aw-firstColBox > label[collapsed]")
      ) {
        // If addressing row has no pills nor text, unrepeated Delete keydown,
        // and row has an [x] button, hide row and focus next available row.
        hideAddressRow(input, "next");
      }
      break;

    case "Enter":
      // If no address entered, move focus to the next available element,
      // but not for Ctrl/Cmd+[Shift]+Enter keyboard shortcuts for sending.
      if (!input.value.trim() && !event.ctrlKey && !event.metaKey) {
        // Prevent Enter from firing again on the element we move the focus to.
        event.preventDefault();
        SetFocusOnNextAvailableElement(input);
      }

      // macOS only variation necessary to send messages since autocomplete
      // input fields prevent that by default.
      if (event.metaKey) {
        // Prevent the focus from moving to the next element.
        event.stopPropagation();
        goDoCommand("cmd_sendWithCheck");
      }
      break;

    case "Tab":
      // Trigger the autocomplete controller only if we have a value,
      // to prevent interfering with the natural change of focus on Tab.
      if (input.value.trim()) {
        // Prevent Tab from firing again on address input after pill creation.
        event.preventDefault();
        input.handleEnter(event);
      }

      // Handle Shift+Tab, but not Ctrl+Shift+Tab for fast focus ring backwards.
      if (event.shiftKey && !event.ctrlKey && !event.metaKey) {
        // Prevent Shift+Tab from firing again where we move the focus to.
        event.preventDefault();
        input.closest("mail-recipients-area").moveFocusToPreviousElement(input);
      }
      break;
  }
}

/**
 * Add one or more <mail-address-pill> elements to the containing address row.
 *
 * @param {Element} input - Address input where "autocomplete-did-enter-text"
 *   was observed, and/or to whose containing address row pill(s) will be added.
 * @param {boolean} [automatic=false] - Set to true if the change of recipients
 *   was invoked programmatically and should not be considered a change of
 *   message content.
 */
function recipientAddPills(input, automatic = false) {
  if (!input.value.trim()) {
    return;
  }

  let addresses = MailServices.headerParser.makeFromDisplayAddress(input.value);
  let recipientArea = document.getElementById("recipientsContainer");

  for (let address of addresses) {
    recipientArea.createRecipientPill(input, address);
  }

  // Add the just added recipient address(es) to the spellcheck ignore list.
  addRecipientsToIgnoreList(input.value.trim());

  // Reset the input element.
  input.removeAttribute("nomatch");
  input.setAttribute("size", 1);
  input.value = "";

  // We need to detach the autocomplete Controller to prevent the input
  // to be filled with the previously selected address when the "blur" event
  // gets triggered.
  input.detachController();
  // Attach it again to enable autocomplete.
  input.attachController();

  if (!automatic) {
    input
      .closest(".address-container")
      .classList.add("addressing-field-edited");
    onRecipientsChanged();
  }

  calculateHeaderHeight();
  udpateAriaLabelsOfAddressRow(input.closest(".address-row"));
}

/**
 * Remove all <mail-address-pill> elements from the containing address row.
 *
 * @param {Element} input - The address input element in the container to clear.
 */
function recipientClearPills(input) {
  for (let pill of input
    .closest(".address-container")
    .querySelectorAll("mail-address-pill")) {
    pill.remove();
  }
  udpateAriaLabelsOfAddressRow(input.closest(".address-row"));
}

/**
 * Handle focus event of address inputs: Force a focused styling on the closest
 * address container of the currently focused input element.
 *
 * @param {Element} input - The address input element receiving focus.
 */
function addressInputOnFocus(input) {
  input.closest(".address-container").setAttribute("focused", "true");
  deselectAllPills();
}

/**
 * Deselect any previously selected pills.
 */
function deselectAllPills() {
  for (let pill of document.querySelectorAll(`mail-address-pill[selected]`)) {
    pill.removeAttribute("selected");
  }
}

/**
 * Handle blur event of address inputs: Remove focused styling from the closest
 * address container and create address pills if valid recipients were written.
 *
 * @param {Element} input - The input element losing focus.
 */
function addressInputOnBlur(input) {
  input.closest(".address-container").removeAttribute("focused");

  if (input.getAttribute("is") != "autocomplete-input") {
    // For other headers aka raw input, trim and we are done.
    input.value = input.value.trim();
    return;
  }

  let address = input.value.trim();
  if (!address) {
    // If input is empty or whitespace only, clear input to remove any leftover
    // whitespace, reset the input size, and return.
    input.value = "";
    input.setAttribute("size", 1);
    return;
  }

  let listNames = MimeParser.parseHeaderField(
    address,
    MimeParser.HEADER_ADDRESS
  );
  let isMailingList =
    listNames.length > 0 &&
    MailServices.ab.mailListNameExists(listNames[0].name);

  if (
    address &&
    (isValidAddress(address) ||
      isMailingList ||
      input.classList.contains("news-input"))
  ) {
    recipientAddPills(input);
  }

  // Trim any remaining input for which we didn't create a pill.
  if (input.value.trim()) {
    input.value = input.value.trim();
  }
}

/**
 * Trigger the startEditing() method of the mail-address-pill element.
 *
 * @param {XULlement} element - The element from which the context menu was
 *   opened.
 * @param {Event} event - The DOM event.
 */
function editAddressPill(element, event) {
  document
    .getElementById("recipientsContainer")
    .startEditing(element.closest("mail-address-pill"), event);
}

/**
 * Copy the selected pills email address.
 *
 * @param {XULElement} element - The element from which the context menu was
 *   opened.
 */
function copyEmailNewsAddress(element) {
  let selectedAddresses = [
    ...document.getElementById("recipientsContainer").getAllSelectedPills(),
  ].map(pill => pill.fullAddress);

  let clipboard = Cc["@mozilla.org/widget/clipboardhelper;1"].getService(
    Ci.nsIClipboardHelper
  );
  clipboard.copyString(selectedAddresses.join(", "));
}

/**
 * Cut the selected pills email address.
 *
 * @param {XULElement} element - The element from which the context menu was
 *   opened.
 */
function cutEmailNewsAddress(element) {
  copyEmailNewsAddress(element);
  deleteSelectedPills(element);
}

/**
 * Delete the selected pill(s).
 *
 * @param {Element} element - The label element from which the context menu was
 *   opened.
 */
function deleteSelectedPills(element) {
  // element is the <label> of the focused pill, get the pill itself.
  let pill = element.closest("mail-address-pill");
  document.getElementById("recipientsContainer").removeSelectedPills(pill);
}

/**
 * Handle disabling of "Move to..." context menu items according to the types
 * of selected pills.
 */
function emailAddressPillOnPopupShown() {
  let menu = document.getElementById("emailAddressPillPopup");

  // Reset previously disabled menuitems.
  for (let menuitem of menu.querySelectorAll(
    ".pill-action-move, .pill-action-edit"
  )) {
    menuitem.disabled = false;
  }

  // If more than one pill is selected, disable the editing item.
  if (
    document.getElementById("recipientsContainer").getAllSelectedPills()
      .length > 1
  ) {
    menu.querySelector("#editAddressPill").disabled = true;
  }

  // If Newsgroups or Followups are part of the selection, disable everything.
  if (
    document.querySelectorAll(
      `mail-address-pill[recipienttype="addr_newsgroups"][selected]`
    ).length ||
    document.querySelectorAll(
      `mail-address-pill[recipienttype="addr_followup"][selected]`
    ).length
  ) {
    for (let menuitem of menu.querySelectorAll(".pill-action-move")) {
      menuitem.disabled = true;
    }
    return;
  }

  let selectedTypes = [];
  // Add all the recipient types of the selected pills.
  for (let row of document.querySelectorAll(".address-row:not(.hidden)")) {
    if (row.querySelectorAll("mail-address-pill[selected]").length) {
      selectedTypes.push(
        row
          .querySelector(`input[is="autocomplete-input"][recipienttype]`)
          .getAttribute("recipienttype")
      );
    }
  }

  // Interrupt if more than one type is selected.
  if (selectedTypes.length > 1) {
    return;
  }

  switch (selectedTypes[0]) {
    case "addr_to":
      menu.querySelector("#moveAddressPillTo").disabled = true;
      break;

    case "addr_cc":
      menu.querySelector("#moveAddressPillCc").disabled = true;
      break;

    case "addr_bcc":
      menu.querySelector("#moveAddressPillBcc").disabled = true;
      break;
  }
}

/**
 * Move the selected pills email address to another addressing row.
 *
 * @param {Element} element - The element from which the context menu was
 *   opened.
 * @param {string} targetFieldType - The target recipient type, e.g. "addr_to".
 */
function moveSelectedPills(element, targetFieldType) {
  document
    .getElementById("recipientsContainer")
    .moveSelectedPills(element, targetFieldType);
}

/**
 * Handle the keypress event on the recipient labels for keyboard navigation and
 * to show the container row of a hidden recipient (Cc, Bcc, etc.).
 *
 * @param {Event} event - The DOM keypress event.
 * @param {string} rowID - The ID of the container to reveal on Enter.
 */
function showAddressRowKeyPress(event, rowID) {
  switch (event.key) {
    case "Enter":
      showAddressRow(event.target, rowID);
      break;
    case "ArrowUp":
    case "ArrowDown":
    case "ArrowRight":
    case "ArrowLeft":
      let label = event.target;
      // Convert nodelist into an array to tame the beast and use .indexOf().
      let focusable = [
        ...label.parentElement.querySelectorAll(
          ".recipient-label:not([collapsed='true'])"
        ),
      ];
      let lastIndex = focusable.length - 1;
      // Bail out if there's only one item left, so nowhere to go with focus.
      if (lastIndex == 0) {
        break;
      }
      // Move focus inside the panel focus ring.
      let index = focusable.indexOf(label);
      let newIndex;
      if (event.key == "ArrowDown" || event.key == "ArrowRight") {
        newIndex = index == lastIndex ? 0 : ++index;
      } else {
        newIndex = index == 0 ? lastIndex : --index;
      }
      focusable[newIndex].focus();
      // Prevent the keys from being handled again by our listeners on the panel.
      event.stopPropagation();
      break;
  }
}

/**
 * Show the container row of an hidden recipient (Cc, Bcc, etc.).
 *
 * @param {XULElement} label - The clicked label to hide.
 * @param {string} rowID - The ID of the container to reveal.
 */
function showAddressRow(label, rowID) {
  if (label.hasAttribute("disabled")) {
    return;
  }

  let container = document.getElementById(rowID);
  container.classList.remove("hidden");
  label.setAttribute("collapsed", "true");
  // Focus the row input.
  container.querySelector(".address-input[recipienttype]").focus();

  updateRecipientsPanelVisibility();
}

/**
 * Move the selected pills to the container row of an hidden recipient (Cc, Bcc, etc.)
 * in drag and drop operation.
 *
 * @param {XULElement} label - The clicked label to hide.
 * @param {string} rowID - The ID of the container to reveal.
 * @param {string} recipientType - The recipient type for dropped pills to move.
 */
function dropAddressPill(label, rowID, recipientType) {
  let mailRecipientsArea = document.querySelector("mail-recipients-area");
  mailRecipientsArea.moveSelectedPills(
    mailRecipientsArea.getAllSelectedPills()[0],
    recipientType
  );
  showAddressRow(label, rowID);
}

/**
 * Hide the container row of a recipient (Cc, Bcc, etc.).
 * The container can't be hidden if previously typed addresses are listed.
 *
 * @param {XULelement} element - A descendant element of the row to be hidden
 *   (or the row itself), usually the [x] label when triggered, or an empty
 *   address input upon Backspace or Del keydown.
 * @param {("next"|"previous")} [focusType="next"] - How to move focus after
 *   hiding the address row: try to focus the input of an available next sibling
 *   row (for [x] or DEL) or previous sibling row (for BACKSPACE).
 */
function hideAddressRow(element, focusType = "next") {
  let addressRow = element.closest(".address-row");
  let labelID = addressRow.dataset.labelid;

  // Prevent address row removal when sending (disable-on-send).
  if (
    addressRow
      .querySelector(".address-container")
      .classList.contains("disable-container")
  ) {
    return;
  }

  let pills = addressRow.querySelectorAll("mail-address-pill");
  let isEdited = addressRow
    .querySelector(".address-container")
    .classList.contains("addressing-field-edited");

  // Ask the user to confirm the removal of all the typed addresses if the field
  // holds addressing pills and has been previously edited.
  if (isEdited && pills.length) {
    let fieldName = addressRow.querySelector(
      ".address-label-container > label"
    );
    let confirmTitle = getComposeBundle().getFormattedString(
      "confirmRemoveRecipientRowTitle2",
      [fieldName.value]
    );
    let confirmBody = getComposeBundle().getFormattedString(
      "confirmRemoveRecipientRowBody2",
      [fieldName.value]
    );
    let confirmButton = getComposeBundle().getString(
      "confirmRemoveRecipientRowButton"
    );

    let result = Services.prompt.confirmEx(
      window,
      confirmTitle,
      confirmBody,
      Services.prompt.BUTTON_POS_0 * Services.prompt.BUTTON_TITLE_IS_STRING +
        Services.prompt.BUTTON_POS_1 * Services.prompt.BUTTON_TITLE_CANCEL,
      confirmButton,
      null,
      null,
      null,
      {}
    );
    if (result == 1) {
      return;
    }
  }

  for (let pill of pills) {
    pill.remove();
  }

  // Reset the original input.
  let input = addressRow.querySelector(`.address-input[recipienttype]`);
  input.value = "";

  addressRow.classList.add("hidden");
  document.getElementById(labelID).removeAttribute("collapsed");

  // Update the sender button only if the content was previously changed.
  if (isEdited) {
    onRecipientsChanged(true);
  }
  updateRecipientsPanelVisibility();
  udpateAriaLabelsOfAddressRow(addressRow);

  // Move focus to the next focusable address input field.
  let addressRowSibling =
    focusType == "next"
      ? getNextSibling(addressRow, ".address-row:not(.hidden)")
      : getPreviousSibling(addressRow, ".address-row:not(.hidden)");

  if (addressRowSibling) {
    addressRowSibling.querySelector(`.address-input[recipienttype]`).focus();
    return;
  }
  // Otherwise move focus to the subject field or to the first available input.
  let fallbackFocusElement =
    focusType == "next"
      ? document.getElementById("msgSubject")
      : getNextSibling(addressRow, ".address-row:not(.hidden)").querySelector(
          ".address-input[recipienttype]"
        );
  fallbackFocusElement.focus();
}

/**
 * Handle the click event on the close label of an address row.
 *
 * @param {Event} event - The DOM click event.
 */
function closeLabelOnClick(event) {
  hideAddressRow(event.target);
}

/**
 * Handle the keypress event on the close label of an address row.
 *
 * @param {Event} event - The DOM keypress event.
 */
function closeLabelOnKeyPress(event) {
  let closeLabel = event.target;

  switch (event.key) {
    case "Enter":
      hideAddressRow(closeLabel);
      break;

    case "Tab":
      if (event.shiftKey) {
        return;
      }
      event.preventDefault();
      closeLabel
        .closest(".address-row")
        .querySelector(`.address-input[recipienttype]`)
        .focus();
      break;
  }
}

/**
 * Calculate the height of the composer header area when pills are created or
 * removed in order to automatically add or remove the scrollable overflow.
 */
function calculateHeaderHeight() {
  let header = document.getElementById("headers-box");
  let container = document.getElementById("recipientsContainer");

  // Interrupt if the container scrolling area is taller than its clientHeight.
  if (
    container.classList.contains("overflow") &&
    container.scrollHeight > container.clientHeight
  ) {
    return;
  }

  // Remove the overflow if the container scrolling area shrinks below its
  // clientHeight.
  if (
    container.classList.contains("overflow") &&
    container.scrollHeight <= container.clientHeight
  ) {
    container.classList.remove("overflow");
    header.removeAttribute("height");
    return;
  }

  // Add overflow if the header height grows above 30% of the window height.
  let maxHeaderHeight = window.outerHeight * 0.3;
  if (header.clientHeight > maxHeaderHeight) {
    if (!header.hasAttribute("height")) {
      header.setAttribute("height", maxHeaderHeight);
    }
    container.classList.add("overflow");
  }
}

/**
 * Set the min-height of the message header area to prevent overlappings in case
 * the user resizes the area upwards.
 */
function setDefaultHeaderMinHeight() {
  let header = document.getElementById("headers-box");
  header.style.minHeight = `${header.clientHeight}px`;
}

/**
 * Handle keypress event on a label inside #extraRecipientsPanel.
 *
 * @param {event} event - The DOM keypress event on the label.
 */
function extraRecipientsLabelOnKeyPress(event) {
  switch (event.key) {
    case "Enter":
    case "ArrowRight":
    case "ArrowDown":
      // Open the extra recipients panel.
      showExtraRecipients(event);
      break;
    case "ArrowLeft":
    case "ArrowUp":
      // Allow navigating away from focused extraRecipientsLabel using cursor
      // keys.
      let focusable = event.currentTarget.parentElement.querySelectorAll(
        '.recipient-label:not([collapsed="true"]):not(.extra-recipients-label)'
      );
      let focusEl = focusable[focusable.length - 1];
      if (focusEl) {
        focusEl.focus();
      }
      break;
  }
}

/**
 * Show the #extraRecipientsPanel.
 *
 * @param {Event} event - The DOM event.
 */
function showExtraRecipients(event) {
  if (event.currentTarget.hasAttribute("disabled")) {
    return;
  }

  let panel = document.getElementById("extraRecipientsPanel");
  // If panel was opened with keyboard, focus first recipient label;
  // otherwise focus the panel [tabindex=0] to enable keyboard navigation.
  panel.addEventListener(
    "popupshown",
    () => {
      (event.type == "keypress"
        ? panel.querySelector('.recipient-label:not([collapsed="true"])')
        : panel
      ).focus();
    },
    { once: true }
  );
  panel.openPopup(event.originalTarget, "after_end", -8, 0, true);
}

/**
 * Handle keypress event on #extraRecipientsPanel.
 *
 * @param {event} event - The DOM keypress event on the panel.
 */
function extraRecipientsPanelOnKeyPress(event) {
  switch (event.key) {
    case "Enter":
      event.currentTarget.hidePopup();
      break;

    // Ensure access to panel focus ring after *click* on extraRecipientsLabel.
    case "ArrowDown":
      // Focus first focusable recipient label.
      event.currentTarget
        .querySelector('.recipient-label:not([collapsed="true"])')
        .focus();
      break;
    case "ArrowUp":
      // Focus last focusable recipient label.
      let focusable = event.currentTarget.querySelectorAll(
        '.recipient-label:not([collapsed="true"])'
      );
      focusable[focusable.length - 1].focus();
      break;
  }
}

/**
 * Hide or show the panel and overflow button for the extra recipients
 * based on the currently available labels.
 */
function updateRecipientsPanelVisibility() {
  document.getElementById("extraRecipientsLabel").collapsed =
    document
      .getElementById("extraRecipientsPanel")
      .querySelectorAll('label:not([collapsed="true"])').length == 0;

  // Toggle the class to show/hide the pseudo element separator
  // of the msgIdentity field.
  document
    .getElementById("msgIdentity")
    .classList.toggle(
      "addressingWidget-separator",
      document
        .getElementById("addressingWidgetLabels")
        .querySelector('label:not([collapsed="true"])')
    );
}
