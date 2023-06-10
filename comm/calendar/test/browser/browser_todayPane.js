/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* globals agendaListbox */

var { cal } = ChromeUtils.import("resource:///modules/calendar/calUtils.jsm");

add_task(async function testTodayPane() {
  // Add a calendar to work with.
  let manager = cal.getCalendarManager();
  let calendar = manager.createCalendar("memory", Services.io.newURI("moz-memory-calendar://"));
  calendar.name = "Mochitest";
  manager.registerCalendar(calendar);
  let pCalendar = cal.async.promisifyCalendar(calendar);

  registerCleanupFunction(async () => {
    manager.unregisterCalendar(calendar);
  });

  // Let the UI respond to the registration of the calendar.
  await new Promise(resolve => setTimeout(resolve));
  await new Promise(resolve => setTimeout(resolve));

  let todayPanePanel = document.getElementById("today-pane-panel");
  let todayPaneStatusButton = document.getElementById("calendar-status-todaypane-button");

  let today = cal.dtz.now();
  let startHour = today.hour;
  today.hour = today.minute = today.second = 0;

  // Go to mail tab.
  selectFolderTab();

  // Verify today pane open.
  if (todayPanePanel.hasAttribute("collapsed")) {
    EventUtils.synthesizeMouseAtCenter(todayPaneStatusButton, {});
  }
  Assert.ok(!todayPanePanel.hasAttribute("collapsed"));

  // Verify today pane's date.
  Assert.equal(document.getElementById("datevalue-label").value, today.day);

  // Tomorrow and soon are collapsed by default. Expand them.
  for (let headerId of ["today-header", "tomorrow-header", "nextweek-header"]) {
    let header = document.getElementById(headerId);
    if (header.getAttribute("checked") != "true") {
      EventUtils.synthesizeMouseAtCenter(header.firstElementChild.firstElementChild, {});
    }
    Assert.equal(header.getAttribute("checked"), "true");
  }

  // Create some events.
  let todaysEvent = cal.createEvent();
  todaysEvent.title = "Today's Event";
  todaysEvent.startDate = today.clone();
  todaysEvent.startDate.hour = Math.min(startHour + 6, 23);
  todaysEvent.endDate = todaysEvent.startDate.clone();
  todaysEvent.endDate.hour++;

  let tomorrowsEvent = cal.createEvent();
  tomorrowsEvent.title = "Tomorrow's Event";
  tomorrowsEvent.startDate = today.clone();
  tomorrowsEvent.startDate.day++;
  tomorrowsEvent.startDate.hour = 9;
  tomorrowsEvent.endDate = tomorrowsEvent.startDate.clone();
  tomorrowsEvent.endDate.hour++;

  let futureEvent = cal.createEvent();
  futureEvent.id = "this is what we're waiting for";
  futureEvent.title = "Future Event";
  futureEvent.startDate = today.clone();
  futureEvent.startDate.day += 3;
  futureEvent.startDate.hour = 11;
  futureEvent.endDate = futureEvent.startDate.clone();
  futureEvent.endDate.hour++;

  let promiseFutureEventAdded = new Promise(resolve => {
    calendar.addObserver({
      onAddItem(item) {
        if (item.hasSameIds(futureEvent)) {
          calendar.removeObserver(this);
          resolve();
        }
      },
    });
  });

  await Promise.all([
    pCalendar.addItem(todaysEvent),
    pCalendar.addItem(tomorrowsEvent),
    pCalendar.addItem(futureEvent),
    promiseFutureEventAdded,
  ]);

  // Let the UI respond to the new events.
  await new Promise(resolve => setTimeout(resolve));
  await new Promise(resolve => setTimeout(resolve));

  // There should be a menupopup child and six list items.
  let listChildren = agendaListbox.agendaListboxControl.children;
  Assert.equal(listChildren.length, 7);
  Assert.equal(listChildren[0].localName, "menupopup");
  Assert.equal(listChildren[1].id, "today-header");
  Assert.equal(listChildren[3].id, "tomorrow-header");
  Assert.equal(listChildren[5].id, "nextweek-header");

  // Verify events shown in today pane.
  let dateFormatter = cal.dtz.formatter;

  let startString = dateFormatter.formatTime(todaysEvent.startDate, cal.dtz.defaultTimezone);
  Assert.equal(
    listChildren[2].querySelector(".agenda-event-start").textContent,
    `${startString} Today's Event`
  );

  startString = dateFormatter.formatTime(tomorrowsEvent.startDate, cal.dtz.defaultTimezone);
  Assert.equal(
    listChildren[4].querySelector(".agenda-event-start").textContent,
    `${startString} Tomorrow's Event`
  );

  startString = dateFormatter.formatDateTime(futureEvent.startDate, cal.dtz.defaultTimezone);
  Assert.equal(listChildren[6].querySelector(".agenda-event-start").textContent, startString);
  Assert.equal(listChildren[6].querySelector(".agenda-event-title").textContent, "Future Event");

  // Delete events.
  EventUtils.synthesizeMouseAtCenter(listChildren[2], {});
  EventUtils.synthesizeKey("VK_DELETE");
  Assert.equal(listChildren.length, 6);

  EventUtils.synthesizeMouseAtCenter(listChildren[3], {});
  EventUtils.synthesizeKey("VK_DELETE");
  Assert.equal(listChildren.length, 5);

  EventUtils.synthesizeMouseAtCenter(listChildren[4], {});
  EventUtils.synthesizeKey("VK_DELETE");
  Assert.equal(listChildren.length, 4);

  // Hide and verify today pane hidden.
  EventUtils.synthesizeMouseAtCenter(todayPaneStatusButton, {});
  Assert.ok(todayPanePanel.hasAttribute("collapsed"));

  // Reset today pane.
  EventUtils.synthesizeMouseAtCenter(todayPaneStatusButton, {});
  Assert.ok(!todayPanePanel.hasAttribute("collapsed"));

  // Collapse tomorrow and soon sections.
  for (let headerId of ["tomorrow-header", "nextweek-header"]) {
    let header = document.getElementById(headerId);
    EventUtils.synthesizeMouseAtCenter(header.firstElementChild.firstElementChild, {});
    Assert.ok(!header.getAttribute("checked"));
  }
});
