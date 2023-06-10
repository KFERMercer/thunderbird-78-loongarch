/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var mozmill = ChromeUtils.import("resource://testing-common/mozmill/mozmill.jsm");

var {
  CALENDARNAME,
  CANVAS_BOX,
  EVENTPATH,
  MULTIWEEK_VIEW,
  closeAllEventDialogs,
  createCalendar,
  deleteCalendars,
  getEventDetails,
  goToDate,
  helpersForController,
  invokeEventDialog,
  switchToView,
} = ChromeUtils.import("resource://testing-common/mozmill/CalendarUtils.jsm");
var { helpersForEditUI, setData } = ChromeUtils.import(
  "resource://testing-common/mozmill/ItemEditingHelpers.jsm"
);

var { cal } = ChromeUtils.import("resource:///modules/calendar/calUtils.jsm");

var controller = mozmill.getMail3PaneController();
var { lookup, lookupEventBox } = helpersForController(controller);

const TITLE1 = "Multiweek View Event";
const TITLE2 = "Multiweek View Event Changed";
const DESC = "Multiweek View Event Description";

add_task(async function setupModule(module) {
  createCalendar(controller, CALENDARNAME);
  switchToView(controller, "multiweek");
  goToDate(controller, 2009, 1, 1);

  // Verify date.
  let day = lookup(`
        ${MULTIWEEK_VIEW}/{"class":"mainbox"}/{"class":"monthgrid"}/[0]/{"selected":"true"}/[0]
    `);
  controller.waitFor(() => day.getNode().mDate.icalString == "20090101");

  // Create event.
  // Thursday of 2009-01-01 should be the selected box in the first row with default settings.
  let hour = new Date().getUTCHours(); // Remember time at click.
  let eventBox = lookupEventBox("multiweek", CANVAS_BOX, 1, 5);
  await invokeEventDialog(controller, eventBox, async (event, iframe) => {
    let { eid: eventid } = helpersForController(event);
    let { getDateTimePicker } = helpersForEditUI(iframe);

    let startTimeInput = getDateTimePicker("STARTTIME");
    let startDateInput = getDateTimePicker("STARTDATE");

    // Check that the start time is correct.
    // Next full hour except last hour hour of the day.
    let nextHour = hour == 23 ? hour : (hour + 1) % 24;
    let someDate = cal.dtz.now();
    someDate.resetTo(2009, 0, 1, nextHour, 0, 0, cal.dtz.floating);
    event.waitForElement(startTimeInput);
    event.assertValue(startTimeInput, cal.dtz.formatter.formatTime(someDate));
    event.assertValue(startDateInput, cal.dtz.formatter.formatDateShort(someDate));

    // Fill in title, description and calendar.
    await setData(event, iframe, {
      title: TITLE1,
      description: DESC,
      calendar: CALENDARNAME,
    });

    // save
    event.click(eventid("button-saveandclose"));
  });

  // If it was created successfully, it can be opened.
  eventBox = lookupEventBox("multiweek", CANVAS_BOX, 1, 5, null, EVENTPATH);
  await invokeEventDialog(controller, eventBox, async (event, iframe) => {
    let { eid: eventid } = helpersForController(event);

    // Change title and save changes.
    await setData(event, iframe, { title: TITLE2 });
    event.click(eventid("button-saveandclose"));
  });

  // Check if name was saved.
  let eventName = lookupEventBox(
    "multiweek",
    CANVAS_BOX,
    1,
    5,
    null,
    `${EVENTPATH}/${getEventDetails("multiweek")}/{"flex":"1"}/{"class":"event-name-label"}`
  );

  controller.waitForElement(eventName);
  controller.waitFor(() => eventName.getNode().value == TITLE2);

  // Delete event.
  controller.click(eventBox);
  controller.keypress(eventBox, "VK_DELETE", {});
  controller.waitForElementNotPresent(eventBox);

  Assert.ok(true, "Test ran to completion");
});

registerCleanupFunction(function teardownModule(module) {
  deleteCalendars(controller, CALENDARNAME);
  closeAllEventDialogs();
});
