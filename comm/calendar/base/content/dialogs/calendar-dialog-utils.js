/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* exported gInTab, gMainWindow, gTabmail, intializeTabOrWindowVariables,
 *          dispose, setDialogId, loadReminders, saveReminder,
 *          commonUpdateReminder, updateLink, rearrangeAttendees,
 *          adaptScheduleAgent, sendMailToOrganizer,
 *          openAttachmentFromItemSummary,
 */

/* import-globals-from ../../../lightning/content/lightning-item-iframe.js */
/* import-globals-from ../calendar-ui-utils.js */

var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

var { cal } = ChromeUtils.import("resource:///modules/calendar/calUtils.jsm");

// Variables related to whether we are in a tab or a window dialog.
var gInTab = false;
var gMainWindow = null;
var gTabmail = null;

/**
 * Initialize variables for tab vs window.
 */
function intializeTabOrWindowVariables() {
  let args = window.arguments[0];
  gInTab = args.inTab;
  if (gInTab) {
    gTabmail = parent.document.getElementById("tabmail");
    gMainWindow = parent;
  } else {
    gMainWindow = parent.opener;
  }
}

/**
 * Dispose of controlling operations of this event dialog. Uses
 * window.arguments[0].job.dispose()
 */
function dispose() {
  let args = window.arguments[0];
  if (args.job && args.job.dispose) {
    args.job.dispose();
  }
}

/**
 * Sets the id of a Dialog to another value to allow different styles and the icon
 * attribute for window-icons to be displayed.
 *
 * @param aDialog               The Dialog to be changed.
 * @param aNewId                The new ID as String.
 */
function setDialogId(aDialog, aNewId) {
  aDialog.setAttribute("id", aNewId);
  aDialog.setAttribute("icon", aNewId);
  applyPersistedProperties(aDialog);
}

/**
 * Apply the persisted properties from xulstore.json on a dialog based on the current dialog id.
 * This needs to be invoked after changing a dialog id while loading to apply the values for the
 * new dialog id.
 *
 * @param aDialog               The Dialog to apply the property values for
 */
function applyPersistedProperties(aDialog) {
  let xulStore = Services.xulStore;
  // first we need to detect which properties are persisted
  let persistedProps = aDialog.getAttribute("persist") || "";
  if (persistedProps == "") {
    return;
  }
  let propNames = persistedProps.split(" ");
  let { outerWidth: width, outerHeight: height } = aDialog;
  let doResize = false;
  // now let's apply persisted values if applicable
  for (let propName of propNames) {
    if (xulStore.hasValue(aDialog.baseURI, aDialog.id, propName)) {
      let propValue = xulStore.getValue(aDialog.baseURI, aDialog.id, propName);
      if (propName == "width") {
        width = propValue;
        doResize = true;
      } else if (propName == "height") {
        height = propValue;
        doResize = true;
      } else {
        aDialog.setAttribute(propName, propValue);
      }
    }
  }

  if (doResize) {
    aDialog.ownerGlobal.resizeTo(width, height);
  }
}

/**
 * Create a calIAlarm from the given menuitem. The menuitem must have the
 * following attributes: unit, length, origin, relation.
 *
 * @param {Element} aMenuitem          The menuitem to create the alarm from.
 * @param {calICalendar} aCalendar     The calendar for getting the default alarm type.
 * @return                             The calIAlarm with information from the menuitem.
 */
function createReminderFromMenuitem(aMenuitem, aCalendar) {
  let reminder = aMenuitem.reminder || cal.createAlarm();
  // clone immutable reminders if necessary to set default values
  let isImmutable = !reminder.isMutable;
  if (isImmutable) {
    reminder = reminder.clone();
  }
  let offset = cal.createDuration();
  offset[aMenuitem.getAttribute("unit")] = aMenuitem.getAttribute("length");
  offset.normalize();
  offset.isNegative = aMenuitem.getAttribute("origin") == "before";
  reminder.related =
    aMenuitem.getAttribute("relation") == "START"
      ? reminder.ALARM_RELATED_START
      : reminder.ALARM_RELATED_END;
  reminder.offset = offset;
  reminder.action = getDefaultAlarmType(aCalendar);
  // make reminder immutable in case it was before
  if (isImmutable) {
    reminder.makeImmutable();
  }
  return reminder;
}

/**
 * This function opens the needed dialogs to edit the reminder. Note however
 * that calling this function from an extension is not recommended. To allow an
 * extension to open the reminder dialog, set the menulist "item-alarm" to the
 * custom menuitem and call updateReminder().
 *
 * @param {Element} reminderList - The reminder menu element.
 * @param {calIEvent | calIToDo} calendarItem - The calendar item.
 * @param {number} lastAlarmSelection - Index of previously selected item in the menu.
 * @param {calICalendar} calendar - The calendar to use.
 * @param {calITimezone} [timezone] - Timezone to use.
 */
function editReminder(
  reminderList,
  calendarItem,
  lastAlarmSelection,
  calendar,
  timezone = cal.dtz.defaultTimezone
) {
  let customItem = reminderList.querySelector(".reminder-custom-menuitem");

  let args = {
    reminders: customItem.reminders,
    item: calendarItem,
    timezone,
    calendar,
    // While these are "just" callbacks, the dialog is opened modally, so aside
    // from what's needed to set up the reminders, nothing else needs to be done.
    onOk(reminders) {
      customItem.reminders = reminders;
    },
    onCancel() {
      reminderList.selectedIndex = lastAlarmSelection;
    },
  };

  window.setCursor("wait");

  // open the dialog modally
  openDialog(
    "chrome://calendar/content/calendar-event-dialog-reminder.xhtml",
    "_blank",
    "chrome,titlebar,modal,resizable,centerscreen",
    args
  );
}

/**
 * Update the reminder details from the selected alarm. This shows a string
 * describing the reminder set, or nothing in case a preselected reminder was
 * chosen.
 *
 * @param {Element} reminderDetails - The reminder details element.
 * @param {Element} reminderList - The reminder menu element.
 * @param {calICalendar} calendar - The calendar.
 */
function updateReminderDetails(reminderDetails, reminderList, calendar) {
  // find relevant elements in the document
  let reminderMultipleLabel = reminderDetails.querySelector(".reminder-multiple-alarms-label");
  let iconBox = reminderDetails.querySelector(".reminder-icon-box");
  let reminderSingleLabel = reminderDetails.querySelector(".reminder-single-alarms-label");

  let reminders = reminderList.querySelector(".reminder-custom-menuitem").reminders || [];

  let actionValues = calendar.getProperty("capabilities.alarms.actionValues") || ["DISPLAY"];
  let actionMap = {};
  for (let action of actionValues) {
    actionMap[action] = true;
  }

  // Filter out any unsupported action types.
  reminders = reminders.filter(x => x.action in actionMap);

  if (reminderList.value == "custom") {
    // Depending on how many alarms we have, show either the "Multiple Alarms"
    // label or the single reminder label.
    setElementValue(reminderMultipleLabel, reminders.length < 2 && "true", "hidden");
    setElementValue(reminderSingleLabel, reminders.length > 1 && "true", "hidden");

    cal.alarms.addReminderImages(iconBox, reminders);

    // If there is only one reminder, display the reminder string
    if (reminders.length == 1) {
      setElementValue(reminderSingleLabel, reminders[0].toString(window.calendarItem));
    }
  } else {
    reminderMultipleLabel.setAttribute("hidden", "true");
    reminderSingleLabel.setAttribute("hidden", "true");
    if (reminderList.value == "none") {
      // No reminder selected means show no icons.
      removeChildren(iconBox);
    } else {
      // This is one of the predefined dropdown items. We should show a
      // single icon in the icons box to tell the user what kind of alarm
      // this will be.
      let mockAlarm = cal.createAlarm();
      mockAlarm.action = getDefaultAlarmType(calendar);
      cal.alarms.addReminderImages(iconBox, [mockAlarm]);
    }
  }
}

/**
 * Check whether a reminder matches one of the default menu items or not.
 *
 * @param {calIAlarm} reminder - The reminder to match to a menu item.
 * @param {Element} reminderList - The reminder menu element.
 * @param {calICalendar} calendar - The current calendar, to get the default alarm type.
 * @return {boolean} True if the reminder matches a menu item, false if not.
 */
function matchCustomReminderToMenuitem(reminder, reminderList, calendar) {
  let defaultAlarmType = getDefaultAlarmType(calendar);
  let reminderPopup = reminderList.menupopup;
  if (
    reminder.related != Ci.calIAlarm.ALARM_RELATED_ABSOLUTE &&
    reminder.offset &&
    reminder.action == defaultAlarmType
  ) {
    // Exactly one reminder that's not absolute, we may be able to match up
    // popup items.
    let relation = reminder.related == reminder.ALARM_RELATED_START ? "START" : "END";

    // If the time duration for offset is 0, means the reminder is '0 minutes before'
    let origin = reminder.offset.inSeconds == 0 || reminder.offset.isNegative ? "before" : "after";

    let unitMap = {
      days: 86400,
      hours: 3600,
      minutes: 60,
    };

    for (let menuitem of reminderPopup.children) {
      if (
        menuitem.localName == "menuitem" &&
        menuitem.hasAttribute("length") &&
        menuitem.getAttribute("origin") == origin &&
        menuitem.getAttribute("relation") == relation
      ) {
        let unitMult = unitMap[menuitem.getAttribute("unit")] || 1;
        let length = menuitem.getAttribute("length") * unitMult;

        if (Math.abs(reminder.offset.inSeconds) == length) {
          menuitem.reminder = reminder.clone();
          reminderList.selectedItem = menuitem;
          // We've selected an item, so we are done here.
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Load an item's reminders into the dialog.
 *
 * @param {calIAlarm[]} reminders     An array of alarms to load.
 * @param {Element} reminderList      The reminders menulist element.
 * @param {calICalendar} calendar     The calendar the item belongs to.
 * @return {number}                   Index of the selected item in reminders menu.
 */
function loadReminders(reminders, reminderList, calendar) {
  // Select 'no reminder' by default.
  reminderList.selectedIndex = 0;

  if (!reminders || !reminders.length) {
    // No reminders selected, we are done
    return reminderList.selectedIndex;
  }

  if (
    reminders.length > 1 ||
    !matchCustomReminderToMenuitem(reminders[0], reminderList, calendar)
  ) {
    // If more than one alarm is selected, or we didn't find a matching item
    // above, then select the "custom" item and attach the item's reminders to
    // it.
    reminderList.value = "custom";
    reminderList.querySelector(".reminder-custom-menuitem").reminders = reminders;
  }

  // Return the selected index so it can be remembered.
  return reminderList.selectedIndex;
}

/**
 * Save the selected reminder into the passed item.
 *
 * @param {calIEvent | calITodo} item   The calendar item to save the reminder into.
 * @param {calICalendar} calendar       The current calendar.
 * @param {Element} reminderList        The reminder menu element.
 */
function saveReminder(item, calendar, reminderList) {
  // We want to compare the old alarms with the new ones. If these are not
  // the same, then clear the snooze/dismiss times
  let oldAlarmMap = {};
  for (let alarm of item.getAlarms()) {
    oldAlarmMap[alarm.icalString] = true;
  }

  // Clear the alarms so we can add our new ones.
  item.clearAlarms();

  if (reminderList.value != "none") {
    let menuitem = reminderList.selectedItem;
    let reminders;

    if (menuitem.reminders) {
      // Custom reminder entries carry their own reminder object with
      // them. Make sure to clone in case these are the original item's
      // reminders.

      // XXX do we need to clone here?
      reminders = menuitem.reminders.map(x => x.clone());
    } else {
      // Pre-defined entries specify the necessary information
      // as attributes attached to the menuitem elements.
      reminders = [createReminderFromMenuitem(menuitem, calendar)];
    }

    let alarmCaps = item.calendar.getProperty("capabilities.alarms.actionValues") || ["DISPLAY"];
    let alarmActions = {};
    for (let action of alarmCaps) {
      alarmActions[action] = true;
    }

    // Make sure only alarms are saved that work in the given calendar.
    reminders.filter(x => x.action in alarmActions).forEach(item.addAlarm, item);
  }

  // Compare alarms to see if something changed.
  for (let alarm of item.getAlarms()) {
    let ics = alarm.icalString;
    if (ics in oldAlarmMap) {
      // The new alarm is also in the old set, remember this
      delete oldAlarmMap[ics];
    } else {
      // The new alarm is not in the old set, this means the alarms
      // differ and we can break out.
      oldAlarmMap[ics] = true;
      break;
    }
  }

  // If the alarms differ, clear the snooze/dismiss properties
  if (Object.keys(oldAlarmMap).length > 0) {
    let cmp = "X-MOZ-SNOOZE-TIME";

    // Recurring item alarms potentially have more snooze props, remove them
    // all.
    let propsToDelete = [];
    for (let [name] of item.properties) {
      if (name.startsWith(cmp)) {
        propsToDelete.push(name);
      }
    }

    item.alarmLastAck = null;
    propsToDelete.forEach(item.deleteProperty, item);
  }
}

/**
 * Get the default alarm type for the currently selected calendar. If the
 * calendar supports DISPLAY alarms, this is the default. Otherwise it is the
 * first alarm action the calendar supports.
 *
 * @param {calICalendar} calendar - The calendar to use.
 * @return {string} The default alarm type.
 */
function getDefaultAlarmType(calendar) {
  let alarmCaps = calendar.getProperty("capabilities.alarms.actionValues") || ["DISPLAY"];
  return alarmCaps.includes("DISPLAY") ? "DISPLAY" : alarmCaps[0];
}

/**
 * Common update functions for both event dialogs. Called when a reminder has
 * been selected from the menulist.
 *
 * @param {Element} reminderList - The reminders menu element.
 * @param {calIEvent | calITodo} calendarItem - The calendar item.
 * @param {number} lastAlarmSelection - Index of the previous selection in the reminders menu.
 * @param {Element} reminderDetails - The reminder details element.
 * @param {calITimezone} timezone - The relevant timezone.
 * @param {boolean} suppressDialogs - If true, controls are updated without prompting
 *                                    for changes with the dialog
 * @return {number} Index of the item selected in the reminders menu.
 */
function commonUpdateReminder(
  reminderList,
  calendarItem,
  lastAlarmSelection,
  calendar,
  reminderDetails,
  timezone,
  suppressDialogs
) {
  // if a custom reminder has been selected, we show the appropriate
  // dialog in order to allow the user to specify the details.
  // the result will be placed in the 'reminder-custom-menuitem' tag.
  if (reminderList.value == "custom") {
    // Clear the reminder icons first, this will make sure that while the
    // dialog is open the default reminder image is not shown which may
    // confuse users.
    removeChildren(reminderDetails.querySelector(".reminder-icon-box"));

    // show the dialog. This call blocks until the dialog is closed. Don't
    // pop up the dialog if aSuppressDialogs was specified or if this
    // happens during initialization of the dialog
    if (!suppressDialogs && reminderList.hasAttribute("last-value")) {
      editReminder(reminderList, calendarItem, lastAlarmSelection, calendar, timezone);
    }

    if (reminderList.value == "custom") {
      // Only do this if the 'custom' item is still selected. If the edit
      // reminder dialog was canceled then the previously selected
      // menuitem is selected, which may not be the custom menuitem.

      // If one or no reminders were selected, we have a chance of mapping
      // them to the existing elements in the dropdown.
      let customItem = reminderList.selectedItem;
      if (customItem.reminders.length == 0) {
        // No reminder was selected
        reminderList.value = "none";
      } else if (customItem.reminders.length == 1) {
        // We might be able to match the custom reminder with one of the
        // default menu items.
        matchCustomReminderToMenuitem(customItem.reminders[0], reminderList, calendar);
      }
    }
  }

  reminderList.setAttribute("last-value", reminderList.value);

  // possibly the selected reminder conflicts with the item.
  // for example an end-relation combined with a task without duedate
  // is an invalid state we need to take care of. we take the same
  // approach as with recurring tasks. in case the reminder is related
  // to the entry date we check the entry date automatically and disable
  // the checkbox. the same goes for end related reminder and the due date.
  if (cal.item.isToDo(calendarItem)) {
    // In general, (re-)enable the due/entry checkboxes. This will be
    // changed in case the alarms are related to START/END below.
    enableElementWithLock("todo-has-duedate", "reminder-lock");
    enableElementWithLock("todo-has-entrydate", "reminder-lock");

    let menuitem = reminderList.selectedItem;
    if (menuitem.value != "none") {
      // In case a reminder is selected, retrieve the array of alarms from
      // it, or create one from the currently selected menuitem.
      let reminders = menuitem.reminders || [createReminderFromMenuitem(menuitem, calendar)];

      // If a reminder is related to the entry date...
      if (reminders.some(x => x.related == x.ALARM_RELATED_START)) {
        // ...automatically check 'has entrydate'.
        if (!getElementValue("todo-has-entrydate", "checked")) {
          setElementValue("todo-has-entrydate", "true", "checked");

          // Make sure gStartTime is properly initialized
          updateEntryDate();
        }

        // Disable the checkbox to indicate that we need the entry-date.
        disableElementWithLock("todo-has-entrydate", "reminder-lock");
      }

      // If a reminder is related to the due date...
      if (reminders.some(x => x.related == x.ALARM_RELATED_END)) {
        // ...automatically check 'has duedate'.
        if (!getElementValue("todo-has-duedate", "checked")) {
          setElementValue("todo-has-duedate", "true", "checked");

          // Make sure gStartTime is properly initialized
          updateDueDate();
        }

        // Disable the checkbox to indicate that we need the entry-date.
        disableElementWithLock("todo-has-duedate", "reminder-lock");
      }
    }
  }
  updateReminderDetails(reminderDetails, reminderList, calendar);

  // Return the current reminder drop down selection index so it can be remembered.
  return reminderList.selectedIndex;
}

/**
 * Updates the related link on the dialog. Currently only used by the
 * read-only summary dialog.
 *
 * @param {string} itemUrlString - The calendar item URL as a string.
 * @param {Element} linkRow - The row containing the link.
 * @param {Element} urlLink - The link element itself.
 */
function updateLink(itemUrlString, linkRow, urlLink) {
  let linkCommand = document.getElementById("cmd_toggle_link");

  if (linkCommand) {
    // Disable if there is no url.
    setBooleanAttribute(linkCommand, "disabled", !itemUrlString);
  }

  if ((linkCommand && linkCommand.getAttribute("checked") != "true") || !itemUrlString.length) {
    // Hide if there is no url, or the menuitem was chosen so that the url
    // should be hidden
    setBooleanAttribute(linkRow, "hidden", true);
  } else {
    let handler, uri;
    try {
      uri = Services.io.newURI(itemUrlString);
      handler = Services.io.getProtocolHandler(uri.scheme);
    } catch (e) {
      // No protocol handler for the given protocol, or invalid uri
      setBooleanAttribute(linkRow, "hidden", true);
      return;
    }

    // Only show if its either an internal protocol handler, or its external
    // and there is an external app for the scheme
    handler = cal.wrapInstance(handler, Ci.nsIExternalProtocolHandler);
    let show = !handler || handler.externalAppExistsForScheme(uri.scheme);
    setBooleanAttribute(linkRow, "hidden", !show);

    setTimeout(() => {
      // HACK the url link doesn't crop when setting the value in onLoad
      setElementValue(urlLink, itemUrlString);
      setElementValue(urlLink, itemUrlString, "href");
    }, 0);
  }
}

/**
 * Set up attendees in event and summary dialog.
 *
 * @param {calIAttendee[]} attendees - The attendees.
 * @param {Element} container - Element containing attendees rows, template, etc.
 * @param {number} attendeesInRow - The number of attendees that can fit in each row.
 * @param {number} maxLabelWidth - Maximum width of the label.
 * @return {{attendeesInRow: number, maxLabelWidth: number}} The new values.
 */
function setupAttendees(attendees, container, attendeesInRow, maxLabelWidth) {
  let attBox = container.querySelector(".item-attendees-box");
  let attBoxRows = attBox.getElementsByClassName("item-attendees-row");
  let newAttendeesInRow = attendeesInRow;
  let newMaxLabelWidth = maxLabelWidth;

  if (attendees && attendees.length > 0) {
    // cloning of the template nodes
    let row = container.querySelector(".item-attendees-box-template .item-attendees-row");

    let clonedRow = row.cloneNode(false);
    let clonedCell = row.querySelector("box:nth-of-type(1)").cloneNode(true);
    let clonedSpacer = row.querySelector("box:nth-of-type(2)").cloneNode(false);

    // determining of attendee box setup
    let inRow = attendeesInRow || -1;
    if (inRow == -1) {
      inRow = determineAttendeesInRow(maxLabelWidth);
      newAttendeesInRow = inRow;
    } else {
      while (attBoxRows.length > 0) {
        attBox.removeChild(attBoxRows[0]);
      }
    }

    // set up of the required nodes
    let maxRows = Math.ceil(attendees.length / inRow);
    let inLastRow = attendees.length - (maxRows - 1) * inRow;
    let attCount = 0;
    while (attBox.getElementsByClassName("item-attendees-row").length < maxRows) {
      let newRow = clonedRow.cloneNode(false);
      let row = attBox.appendChild(newRow);
      row.removeAttribute("hidden");
      let rowCount = attBox.getElementsByClassName("item-attendees-row").length;
      let reqAtt = rowCount == maxRows ? inLastRow : inRow;
      // we add as many attendee cells as required
      while (row.children.length < reqAtt) {
        let newCell = clonedCell.cloneNode(true);
        let cell = row.appendChild(newCell);
        let icon = cell.getElementsByTagName("img")[0];
        let text = cell.getElementsByTagName("label")[0];
        let attendee = attendees[attCount];

        let label =
          attendee.commonName && attendee.commonName.length
            ? attendee.commonName
            : attendee.toString();
        let userType = attendee.userType || "INDIVIDUAL";
        let role = attendee.role || "REQ-PARTICIPANT";
        let partstat = attendee.participationStatus || "NEEDS-ACTION";

        icon.setAttribute("partstat", partstat);
        icon.setAttribute("usertype", userType);
        icon.setAttribute("role", role);
        cell.setAttribute("attendeeid", attendee.id);
        cell.removeAttribute("hidden");

        let userTypeString = cal.l10n.getCalString("dialog.tooltip.attendeeUserType2." + userType, [
          attendee.toString(),
        ]);
        let roleString = cal.l10n.getCalString("dialog.tooltip.attendeeRole2." + role, [
          userTypeString,
        ]);
        let partstatString = cal.l10n.getCalString("dialog.tooltip.attendeePartStat2." + partstat, [
          label,
        ]);
        let tooltip = cal.l10n.getCalString("dialog.tooltip.attendee.combined", [
          roleString,
          partstatString,
        ]);

        let del = cal.itip.resolveDelegation(attendee, attendees);
        if (del.delegators != "") {
          del.delegators = cal.l10n.getCalString("dialog.attendee.append.delegatedFrom", [
            del.delegators,
          ]);
          label += " " + del.delegators;
          tooltip += " " + del.delegators;
        }
        if (del.delegatees != "") {
          del.delegatees = cal.l10n.getCalString("dialog.attendee.append.delegatedTo", [
            del.delegatees,
          ]);
          tooltip += " " + del.delegatees;
        }

        text.setAttribute("value", label);
        cell.setAttribute("tooltiptext", tooltip);
        attCount++;
      }
      // we fill the row with placeholders if required
      if (attBox.getElementsByClassName("item-attendees-row").length > 1 && inRow > 1) {
        while (row.children.length < inRow) {
          let newSpacer = clonedSpacer.cloneNode(true);
          newSpacer.removeAttribute("hidden");
          row.appendChild(newSpacer);
        }
      }
    }

    // determining of the max width of an attendee label - this needs to
    // be done only once and is obsolete in case of resizing
    if (!maxLabelWidth) {
      let maxWidth = 0;
      for (let cell of attBox.getElementsByClassName("item-attendees-cell")) {
        cell = cell.cloneNode(true);
        cell.removeAttribute("flex");
        cell.getElementsByTagName("label")[0].removeAttribute("flex");
        maxWidth = cell.clientWidth > maxWidth ? cell.clientWidth : maxWidth;
      }
      newMaxLabelWidth = maxWidth;
    }
  } else {
    while (attBoxRows.length > 0) {
      attBox.removeChild(attBoxRows[0]);
    }
  }
  return { attendeesInRow: newAttendeesInRow, maxLabelWidth: newMaxLabelWidth };
}

/**
 * Re-arranges the attendees on dialog resizing in event and summary dialog
 *
 * @param {calIAttendee[]} attendees - The attendees.
 * @param {Element} parent - Element containing attendees rows, template, etc.
 * @param {number} attendeesInRow - The number of attendees that can fit in each row.
 * @param {number} maxLabelWidth - Maximum width of the label.
 * @return {{attendeesInRow: number, maxLabelWidth: number}} The new values.
 */
function rearrangeAttendees(attendees, parent, attendeesInRow, maxLabelWidth) {
  if (attendees && attendees.length > 0 && attendeesInRow) {
    let inRow = determineAttendeesInRow(maxLabelWidth);
    if (inRow != attendeesInRow) {
      return setupAttendees(attendees, parent, inRow, maxLabelWidth);
    }
  }
  return { attendeesInRow, maxLabelWidth };
}

/**
 * Calculates the number of columns to distribute attendees for event and summary dialog
 *
 * @param {number} maxLabelWidth - The maximum width for the label.
 * @return {number} The number of attendees that can fit in a row.
 */
function determineAttendeesInRow(maxLabelWidth) {
  // as default value a reasonable high value is appropriate
  // it will be recalculated anyway.
  let minWidth = maxLabelWidth || 200;
  let inRow = Math.floor(document.documentElement.clientWidth / minWidth);
  return inRow > 1 ? inRow : 1;
}

/**
 * Adapts the scheduling responsibility for caldav servers according to RfC 6638
 * based on forceEmailScheduling preference for the respective calendar
 *
 * @param {calIEvent|calIToDo} aItem      Item to apply the change on
 */
function adaptScheduleAgent(aItem) {
  if (
    aItem.calendar &&
    aItem.calendar.type == "caldav" &&
    aItem.calendar.getProperty("capabilities.autoschedule.supported")
  ) {
    let identity = aItem.calendar.getProperty("imip.identity");
    let orgEmail = identity && identity.QueryInterface(Ci.nsIMsgIdentity).email;
    let organizerAction = aItem.organizer && orgEmail && aItem.organizer.id == "mailto:" + orgEmail;
    if (aItem.calendar.getProperty("forceEmailScheduling")) {
      cal.LOG("Enforcing clientside email based scheduling.");
      // for attendees, we change schedule-agent only in case of an
      // organizer triggered action
      if (organizerAction) {
        aItem.getAttendees().forEach(aAttendee => {
          // overwriting must always happen consistently for all
          // attendees regarding SERVER or CLIENT but must not override
          // e.g. NONE, so we only overwrite if the param is set to
          // SERVER or doesn't exist
          if (
            aAttendee.getProperty("SCHEDULE-AGENT") == "SERVER" ||
            !aAttendee.getProperty("SCHEDULE-AGENT")
          ) {
            aAttendee.setProperty("SCHEDULE-AGENT", "CLIENT");
            aAttendee.deleteProperty("SCHEDULE-STATUS");
            aAttendee.deleteProperty("SCHEDULE-FORCE-SEND");
          }
        });
      } else if (
        aItem.organizer &&
        (aItem.organizer.getProperty("SCHEDULE-AGENT") == "SERVER" ||
          !aItem.organizer.getProperty("SCHEDULE-AGENT"))
      ) {
        // for organizer, we change the schedule-agent only in case of
        // an attendee triggered action
        aItem.organizer.setProperty("SCHEDULE-AGENT", "CLIENT");
        aItem.organizer.deleteProperty("SCHEDULE-STATUS");
        aItem.organizer.deleteProperty("SCHEDULE-FORCE-SEND");
      }
    } else if (organizerAction) {
      aItem.getAttendees().forEach(aAttendee => {
        if (aAttendee.getProperty("SCHEDULE-AGENT") == "CLIENT") {
          aAttendee.deleteProperty("SCHEDULE-AGENT");
        }
      });
    } else if (aItem.organizer && aItem.organizer.getProperty("SCHEDULE-AGENT") == "CLIENT") {
      aItem.organizer.deleteProperty("SCHEDULE-AGENT");
    }
  }
}

/**
 * Extracts the item's organizer and opens a compose window to send the
 * organizer an email.
 *
 * @param {calIEvent | calITodo} item - The calendar item.
 */
function sendMailToOrganizer(item) {
  let organizer = item.organizer;
  let email = cal.email.getAttendeeEmail(organizer, true);
  let emailSubject = cal.l10n.getString("calendar-event-dialog", "emailSubjectReply", [item.title]);
  let identity = item.calendar.getProperty("imip.identity");
  cal.email.sendTo(email, emailSubject, null, identity);
}

/**
 * Opens an attachment.
 *
 * @param {AUTF8String}  aAttachmentId   The hashId of the attachment to open.
 * @param {calIEvent | calITodo} item    The calendar item.
 */
function openAttachmentFromItemSummary(aAttachmentId, item) {
  if (!aAttachmentId) {
    return;
  }
  let attachments = item
    .getAttachments()
    .filter(aAttachment => aAttachment.hashId == aAttachmentId);

  if (attachments.length && attachments[0].uri && attachments[0].uri.spec != "about:blank") {
    Cc["@mozilla.org/uriloader/external-protocol-service;1"]
      .getService(Ci.nsIExternalProtocolService)
      .loadURI(attachments[0].uri);
  }
}
