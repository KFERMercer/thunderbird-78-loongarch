/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

/* global MozElements MozXULElement */

/* import-globals-from ../../src/calApplicationUtils.js */
/* import-globals-from ../dialogs/calendar-summary-dialog.js */
/* import-globals-from ../dialogs/calendar-dialog-utils.js */

// Wrap in a block to prevent leaking to window scope.
{
  var { cal } = ChromeUtils.import("resource:///modules/calendar/calUtils.jsm");
  var { recurrenceStringFromItem } = ChromeUtils.import(
    "resource:///modules/calendar/calRecurrenceUtils.jsm"
  );

  /**
   * Represents a mostly read-only summary of a calendar item. Used in places
   * like the calendar summary dialog and calendar import dialog. All instances
   * should have an ID attribute.
   */
  class CalendarItemSummary extends MozXULElement {
    connectedCallback() {
      if (this.delayConnectedCallback() || this.hasConnected) {
        return;
      }
      this.hasConnected = true;

      // Generate IDs to make sure they are unique when there is more than one
      // instance of this element in a given scope.
      let id = this.getAttribute("id");
      let itemAttendeesBoxId = id + "-item-attendees-box";
      let itemDescriptionId = id + "-item-description";
      let urlLinkId = id + "-url-link";

      this.appendChild(
        MozXULElement.parseXULToFragment(
          `
          <vbox class="item-summary-box" flex="1">
            <!-- General -->
            <hbox class="calendar-caption" align="center">
              <label value="&read.only.general.label;" class="header"/>
              <separator class="groove" flex="1"/>
            </hbox>
            <html:table class="calendar-summary-table">
              <html:tr>
                <html:th>
                  &read.only.title.label;
                </html:th>
                <html:td class="item-title">
                </html:td>
              </html:tr>
              <html:tr class="calendar-row" hidden="hidden">
                <html:th>
                  &read.only.calendar.label;
                </html:th>
                <html:td class="item-calendar">
                </html:td>
              </html:tr>
              <html:tr class="item-date-row">
                <html:th class="item-start-row-label"
                         taskStartLabel="&read.only.task.start.label;"
                         eventStartLabel="&read.only.event.start.label;">
                </html:th>
                <html:td class="item-date-row-start-date">
                </html:td>
              </html:tr>
              <html:tr class="item-date-row">
                <html:th class="item-due-row-label"
                         taskDueLabel="&read.only.task.due.label;"
                         eventEndLabel="&read.only.event.end.label;">
                </html:th>
                <html:td class="item-date-row-end-date">
                </html:td>
              </html:tr>
              <html:tr class="repeat-row" hidden="hidden">
                <html:th>
                  &read.only.repeat.label;
                </html:th>
                <html:td class="repeat-details">
                </html:td>
              </html:tr>
              <html:tr class="location-row" hidden="hidden">
                <html:th>
                  &read.only.location.label;
                </html:th>
                <html:td class="item-location">
                </html:td>
              </html:tr>
              <html:tr class="category-row" hidden="hidden">
                <html:th>
                  &read.only.category.label;
                </html:th>
                <html:td class="item-category">
                </html:td>
              </html:tr>
              <html:tr class="organizer-row item-attendees-row" hidden="hidden">
                <html:th class="organizer-label">
                  &read.only.organizer.label;
                </html:th>
                <html:td>
                  <hbox class="item-organizer-cell">
                    <img class="itip-icon"/>
                    <label class="item-organizer-label text-link item-attendees-cell-label"
                           crop="end"/>
                    <spacer flex="1"/>
                  </hbox>
                </html:td>
              </html:tr>
              <html:tr class="status-row" hidden="hidden">
                <html:th>
                  &task.status.label;
                </html:th>
                <html:td class="status-row-td">
                  <html:div hidden="true" status="TENTATIVE">&newevent.status.tentative.label;</html:div>
                  <html:div hidden="true" status="CONFIRMED">&newevent.status.confirmed.label;</html:div>
                  <html:div hidden="true" status="CANCELLED">&newevent.eventStatus.cancelled.label;</html:div>
                  <html:div hidden="true" status="CANCELLED">&newevent.todoStatus.cancelled.label;</html:div>
                  <html:div hidden="true" status="NEEDS-ACTION">&newevent.status.needsaction.label;</html:div>
                  <html:div hidden="true" status="IN-PROCESS">&newevent.status.inprogress.label;</html:div>
                  <html:div hidden="true" status="COMPLETED">&newevent.status.completed.label;</html:div>
                </html:td>
              </html:tr>
              <separator class="groove" flex="1" hidden="true"/>
              <html:tr class="reminder-row" hidden="hidden">
                <html:th class="reminder-label">
                  &read.only.reminder.label;
                </html:th>
                <html:td>
                  <hbox align="center">
                    <menulist class="item-alarm"
                              disable-on-readonly="true">
                      <menupopup>
                        <menuitem label="&event.reminder.none.label;"
                                  selected="true"
                                  value="none"/>
                        <menuseparator/>
                        <menuitem label="&event.reminder.0minutes.before.label;"
                                  length="0"
                                  origin="before"
                                  relation="START"
                                  unit="minutes"/>
                        <menuitem label="&event.reminder.5minutes.before.label;"
                                  length="5"
                                  origin="before"
                                  relation="START"
                                  unit="minutes"/>
                        <menuitem label="&event.reminder.15minutes.before.label;"
                                  length="15"
                                  origin="before"
                                  relation="START"
                                  unit="minutes"/>
                        <menuitem label="&event.reminder.30minutes.before.label;"
                                  length="30"
                                  origin="before"
                                  relation="START"
                                  unit="minutes"/>
                        <menuseparator/>
                        <menuitem label="&event.reminder.1hour.before.label;"
                                  length="1"
                                  origin="before"
                                  relation="START"
                                  unit="hours"/>
                        <menuitem label="&event.reminder.2hours.before.label;"
                                  length="2"
                                  origin="before"
                                  relation="START"
                                  unit="hours"/>
                        <menuitem label="&event.reminder.12hours.before.label;"
                                  length="12"
                                  origin="before"
                                  relation="START"
                                  unit="hours"/>
                        <menuseparator/>
                        <menuitem label="&event.reminder.1day.before.label;"
                                  length="1"
                                  origin="before"
                                  relation="START"
                                  unit="days"/>
                        <menuitem label="&event.reminder.2days.before.label;"
                                  length="2"
                                  origin="before"
                                  relation="START"
                                  unit="days"/>
                        <menuitem label="&event.reminder.1week.before.label;"
                                  length="7"
                                  origin="before"
                                  relation="START"
                                  unit="days"/>
                        <menuseparator/>
                        <menuitem class="reminder-custom-menuitem"
                                  label="&event.reminder.custom.label;"
                                  value="custom"/>
                      </menupopup>
                    </menulist>
                    <hbox class="reminder-details">
                      <hbox class="reminder-icon-box alarm-icons-box"
                            align="center"/>
                      <!-- TODO oncommand? onkeypress? -->
                      <label class="reminder-multiple-alarms-label text-link"
                             hidden="true"
                             value="&event.reminder.multiple.label;"
                             disable-on-readonly="true"
                             flex="1"
                             hyperlink="true"/>
                      <label class="reminder-single-alarms-label text-link"
                             hidden="true"
                             disable-on-readonly="true"
                             flex="1"
                             hyperlink="true"/>
                    </hbox>
                  </hbox>
                </html:td>
              </html:tr>
              <html:tr class="attachments-row item-attachments-row" hidden="hidden" >
                <html:th class="attachments-label">
                  &read.only.attachments.label;
                </html:th>
                <html:td>
                  <vbox class="item-attachment-cell">
                    <!-- attachment box template -->
                    <hbox class="attachment-template"
                          hidden="true"
                          align="center"
                          disable-on-readonly="true">
                      <image class="attachment-icon"/>
                      <label class="text-link item-attachment-cell-label"
                             crop="end"
                             flex="1" />
                    </hbox>
                  </vbox>
                </html:td>
              </html:tr>
            </html:table>

            <!-- attendee box template -->
            <vbox class="item-attendees-box-template">
              <hbox flex="1" class="item-attendees-row" equalsize="always" hidden="true">
                <box class="item-attendees-cell" hidden="true" flex="1">
                  <img class="itip-icon"/>
                  <label class="item-attendees-cell-label" crop="end" flex="1"/>
                </box>
                <box hidden="true" flex="1"/>
              </hbox>
            </vbox>

            <!-- Attendees -->
            <box class="item-attendees" orient="vertical" hidden="true" flex="1">
              <spacer class="default-spacer"/>
              <hbox class="calendar-caption" align="center">
                <label value="&read.only.attendees.label;"
                       class="header"
                       control="${itemAttendeesBoxId}"/>
                <separator class="groove" flex="1"/>
              </hbox>
              <vbox id="${itemAttendeesBoxId}" class="item-attendees-box" flex="1" />
            </box>

            <!-- Description -->
            <box class="item-description-box" hidden="true" orient="vertical" flex="1">
              <spacer class="default-spacer"/>
              <hbox class="calendar-caption" align="center">
                <label value="&read.only.description.label;"
                       control="${itemDescriptionId}"
                       class="header"/>
                <separator class="groove" flex="1"/>
              </hbox>
              <hbox class="item-description-wrapper" flex="1">
                <html:textarea id="${itemDescriptionId}"
                               class="item-description"
                               rows="6"
                               flex="1"/>
              </hbox>
            </box>

            <!-- URL link -->
            <box class="event-grid-link-row" hidden="true" orient="vertical">
              <spacer class="default-spacer"/>
              <hbox class="calendar-caption" align="center">
                <label value="&read.only.link.label;"
                       control="${urlLinkId}"
                       class="header"/>
                <separator class="groove" flex="1"/>
              </hbox>
              <label id="${urlLinkId}"
                     class="url-link text-link default-indent"
                     crop="end"/>
            </box>
          </vbox>
          `,
          [
            "chrome://calendar/locale/global.dtd",
            "chrome://calendar/locale/calendar.dtd",
            "chrome://calendar/locale/calendar-event-dialog.dtd",
            "chrome://branding/locale/brand.dtd",
          ]
        )
      );
      this.mItem = null;
      this.mCalendar = null;
      this.mReadOnly = true;

      this.mAttendeesInRow = null;
      this.mMaxLabelWidth = null;

      this.mAlarmsMenu = this.querySelector(".item-alarm");
      this.mIsToDoItem = null;
      this.mLastAlarmSelection = 0;

      this.mAlarmsMenu.addEventListener("command", () => {
        this.updateReminder();
      });

      this.querySelector(".reminder-multiple-alarms-label").addEventListener("click", () => {
        this.updateReminder();
      });

      this.querySelector(".reminder-single-alarms-label").addEventListener("click", () => {
        this.updateReminder();
      });

      this.querySelector(".item-organizer-label").addEventListener("click", () => {
        sendMailToOrganizer(this.mItem);
      });

      let urlLink = this.querySelector(".url-link");
      urlLink.addEventListener("click", event => {
        launchBrowser(urlLink.getAttribute("href"), event);
      });
      urlLink.addEventListener("command", event => {
        launchBrowser(urlLink.getAttribute("href"), event);
      });
    }

    set item(item) {
      this.mItem = item;
      this.mIsToDoItem = cal.item.isToDo(item);

      // When used in places like the import dialog, there is no calendar (yet).
      if (item.calendar) {
        this.mCalendar = cal.wrapInstance(item.calendar, Ci.calISchedulingSupport);

        this.mReadOnly = !(
          cal.acl.isCalendarWritable(this.mCalendar) &&
          (cal.acl.userCanModifyItem(item) ||
            (this.mCalendar &&
              this.mCalendar.isInvitation(item) &&
              cal.acl.userCanRespondToInvitation(item)))
        );
      }

      return item;
    }

    get item() {
      return this.mItem;
    }

    get calendar() {
      return this.mCalendar;
    }

    get readOnly() {
      return this.mReadOnly;
    }

    /**
     * Update the item details in the UI. To be called when this element is
     * first rendered and when the item changes.
     */
    updateItemDetails() {
      if (!this.item) {
        // Setup not complete, do nothing for now.
        return;
      }
      let item = this.item;
      let isToDoItem = this.mIsToDoItem;

      this.querySelector(".item-title").textContent = item.title;

      if (this.calendar) {
        this.querySelector(".calendar-row").removeAttribute("hidden");
        this.querySelector(".item-calendar").textContent = this.calendar.name;
      }

      // Show start date.
      let itemStartDate = item[cal.dtz.startDateProp(item)];

      let itemStartRowLabel = this.querySelector(".item-start-row-label");
      let itemDateRowStartDate = this.querySelector(".item-date-row-start-date");

      itemStartRowLabel.style.visibility = itemStartDate ? "visible" : "collapse";
      itemDateRowStartDate.style.visibility = itemStartDate ? "visible" : "collapse";

      if (itemStartDate) {
        itemStartRowLabel.textContent = itemStartRowLabel.getAttribute(
          isToDoItem ? "taskStartLabel" : "eventStartLabel"
        );
        itemDateRowStartDate.textContent = cal.dtz.getStringForDateTime(itemStartDate);
      }

      // Show due date / end date.
      let itemDueDate = item[cal.dtz.endDateProp(item)];

      let itemDueRowLabel = this.querySelector(".item-due-row-label");
      let itemDateRowEndDate = this.querySelector(".item-date-row-end-date");

      itemDueRowLabel.style.visibility = itemDueDate ? "visible" : "collapse";
      itemDateRowEndDate.style.visibility = itemDueDate ? "visible" : "collapse";

      if (itemDueDate) {
        itemDueRowLabel.textContent = itemDueRowLabel.getAttribute(
          isToDoItem ? "taskDueLabel" : "eventEndLabel"
        );
        itemDateRowEndDate.textContent = cal.dtz.getStringForDateTime(itemDueDate);
      }

      // Show reminder if this item is *not* readonly.
      // This case happens for example if this is an invitation.
      if (!this.readOnly) {
        let argCalendar = item.calendar;

        let supportsReminders =
          argCalendar.getProperty("capabilities.alarms.oninvitations.supported") !== false;

        if (supportsReminders) {
          this.querySelector(".reminder-row").removeAttribute("hidden");
          this.mLastAlarmSelection = loadReminders(
            item.getAlarms(),
            this.mAlarmsMenu,
            this.mItem.calendar
          );
          this.updateReminder();
        }
      }

      let recurrenceDetails = recurrenceStringFromItem(
        item,
        "calendar-event-dialog",
        "ruleTooComplexSummary"
      );
      this.updateRecurrenceDetails(recurrenceDetails);
      this.updateAttendees(item);

      updateLink(
        item.getProperty("URL") || "",
        this.querySelector(".event-grid-link-row"),
        this.querySelector(".url-link")
      );

      let location = item.getProperty("LOCATION");
      if (location) {
        this.updateLocation(location);
      }

      let categories = item.getCategories();
      if (categories.length > 0) {
        this.querySelector(".category-row").removeAttribute("hidden");
        // TODO: this join is unfriendly for l10n (categories.join(", ")).
        this.querySelector(".item-category").textContent = categories.join(", ");
      }

      if (item.organizer && item.organizer.id) {
        this.updateOrganizer(item.organizer);
      }

      let status = item.getProperty("STATUS");
      if (status && status.length) {
        this.updateStatus(status, isToDoItem);
      }

      if (item.hasProperty("DESCRIPTION")) {
        let description = item.getProperty("DESCRIPTION");
        if (description && description.length) {
          this.querySelector(".item-description-box").removeAttribute("hidden");
          let textbox = this.querySelector(".item-description");
          textbox.value = description;
          textbox.readOnly = true;
        }
      }

      let attachments = item.getAttachments();
      if (attachments.length) {
        this.updateAttachments(attachments);
      }
    }

    /**
     * Updates the reminder, called when a reminder has been selected in the
     * menulist.
     */
    updateReminder() {
      this.mLastAlarmSelection = commonUpdateReminder(
        this.mAlarmsMenu,
        this.mItem,
        this.mLastAlarmSelection,
        this.mItem.calendar,
        this.querySelector(".reminder-details"),
        null,
        false
      );
    }

    /**
     * Updates the item's recurrence details, i.e. shows text describing them,
     * or hides the recurrence row if the item does not recur.
     *
     * @param {string | null} details - Recurrence details as a string or null.
     *                                  Passing null hides the recurrence row.
     */
    updateRecurrenceDetails(details) {
      let repeatRow = this.querySelector(".repeat-row");
      let repeatDetails = repeatRow.querySelector(".repeat-details");

      repeatRow.toggleAttribute("hidden", !details);
      repeatDetails.textContent = details ? details.replace(/\n/g, " ") : "";
    }

    /**
     * Updates the attendee listbox, displaying all attendees invited to the item.
     */
    updateAttendees(item) {
      let attendees = item.getAttendees();
      if (attendees && attendees.length) {
        this.querySelector(".item-attendees").removeAttribute("hidden");

        let { attendeesInRow, maxLabelWidth } = setupAttendees(
          attendees,
          this.querySelector(".item-summary-box"),
          this.mAttendeesInRow,
          this.mMaxLabelWidth
        );

        this.mAttendeesInRow = attendeesInRow;
        this.mMaxLabelWidth = maxLabelWidth;
      }
    }

    /**
     * Updates the location, creating a link if the value is a URL.
     *
     * @param {string} location - The value of the location property.
     */
    updateLocation(location) {
      this.querySelector(".location-row").removeAttribute("hidden");
      let urlMatch = location.match(/(https?:\/\/[^ ]*)/);
      let url = urlMatch && urlMatch[1];
      let itemLocation = this.querySelector(".item-location");
      if (url) {
        let link = document.createElementNS("http://www.w3.org/1999/xhtml", "a");
        link.setAttribute("class", "item-location-link text-link");
        link.setAttribute("href", url);
        link.setAttribute("onclick", "launchBrowser(this.getAttribute('href'), event)");
        link.setAttribute("oncommand", "launchBrowser(this.getAttribute('href'), event)");

        let label = document.createXULElement("label");
        label.setAttribute("context", "location-link-context-menu");
        label.textContent = location;
        link.appendChild(label);

        itemLocation.replaceWith(link);
      } else {
        itemLocation.textContent = location;
      }
    }

    /**
     * Handle window resize event. Rearrange attendees.
     */
    onWindowResize() {
      let attendees = this.mItem.getAttendees();
      if (attendees.length) {
        let { attendeesInRow, maxLabelWidth } = rearrangeAttendees(
          attendees,
          this.querySelector(".item-summary-box"),
          this.mAttendeesInRow,
          this.mMaxLabelWidth
        );
        this.mAttendeesInRow = attendeesInRow;
        this.mMaxLabelWidth = maxLabelWidth;
      }
    }

    /**
     * Update the organizer part of the UI.
     *
     * @param {calIAttendee} organizer - The organizer of the calendar item.
     */
    updateOrganizer(organizer) {
      this.querySelector(".organizer-row").removeAttribute("hidden");
      let cell = this.querySelector(".item-organizer-cell");
      let text = cell.querySelector("label");
      let icon = cell.querySelector("img");

      let role = organizer.role || "REQ-PARTICIPANT";
      let userType = organizer.userType || "INDIVIDUAL";
      let partstat = organizer.participationStatus || "NEEDS-ACTION";
      let orgName =
        organizer.commonName && organizer.commonName.length
          ? organizer.commonName
          : organizer.toString();
      let userTypeString = cal.l10n.getCalString("dialog.tooltip.attendeeUserType2." + userType, [
        organizer.toString(),
      ]);
      let roleString = cal.l10n.getCalString("dialog.tooltip.attendeeRole2." + role, [
        userTypeString,
      ]);
      let partstatString = cal.l10n.getCalString("dialog.tooltip.attendeePartStat2." + partstat, [
        orgName,
      ]);
      let tooltip = cal.l10n.getCalString("dialog.tooltip.attendee.combined", [
        roleString,
        partstatString,
      ]);

      text.setAttribute("value", orgName);
      cell.setAttribute("tooltiptext", tooltip);
      icon.setAttribute("partstat", partstat);
      icon.setAttribute("usertype", userType);
      icon.setAttribute("role", role);
    }

    /**
     * Update the status part of the UI.
     *
     * @param {string} status - The status of the calendar item.
     * @param {boolean} isToDoItem - True if the calendar item is a todo, false if an event.
     */
    updateStatus(status, isToDoItem) {
      let statusRow = this.querySelector(".status-row");
      let statusRowData = this.querySelector(".status-row-td");

      for (let i = 0; i < statusRowData.children.length; i++) {
        if (statusRowData.children[i].getAttribute("status") == status) {
          statusRow.removeAttribute("hidden");

          if (status == "CANCELLED" && isToDoItem) {
            // There are two status elements for CANCELLED, the second one is for
            // todo items. Increment the counter here.
            i++;
          }
          statusRowData.children[i].removeAttribute("hidden");
          break;
        }
      }
    }

    /**
     * Update the attachments part of the UI.
     *
     * @param {calIAttachment[]} attachments - Array of attachment objects.
     */
    updateAttachments(attachments) {
      // We only want to display URI type attachments and no ones received inline with the
      // invitation message (having a CID: prefix results in about:blank) here.
      let attCounter = 0;
      attachments.forEach(aAttachment => {
        if (aAttachment.uri && aAttachment.uri.spec != "about:blank") {
          let attachment = this.querySelector(".attachment-template").cloneNode(true);
          attachment.removeAttribute("id");
          attachment.removeAttribute("hidden");

          let label = attachment.querySelector("label");
          label.setAttribute("value", aAttachment.uri.spec);

          label.addEventListener("click", () => {
            openAttachmentFromItemSummary(aAttachment.hashId, this.mItem);
          });

          let icon = attachment.querySelector("image");
          let iconSrc = aAttachment.uri.spec.length ? aAttachment.uri.spec : "dummy.html";
          if (aAttachment.uri && !aAttachment.uri.schemeIs("file")) {
            // Using an uri directly, with e.g. a http scheme, wouldn't render any icon.
            if (aAttachment.formatType) {
              iconSrc = "goat?contentType=" + aAttachment.formatType;
            } else {
              // Let's try to auto-detect.
              let parts = iconSrc.substr(aAttachment.uri.scheme.length + 2).split("/");
              if (parts.length) {
                iconSrc = parts[parts.length - 1];
              }
            }
          }
          icon.setAttribute("src", "moz-icon://" + iconSrc);

          this.querySelector(".item-attachment-cell").appendChild(attachment);
          attCounter++;
        }
      });

      if (attCounter > 0) {
        this.querySelector(".attachments-row").removeAttribute("hidden");
      }
    }
  }

  customElements.define("calendar-item-summary", CalendarItemSummary);
}
