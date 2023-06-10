/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* import-globals-from ../../../../toolkit/components/printing/content/printUtils.js */
/* import-globals-from ../../../../toolkit/content/globalOverlay.js */
/* import-globals-from ../../resources/content/publish.js */
/* import-globals-from agenda-listbox-utils.js */
/* import-globals-from calendar-clipboard.js */
/* import-globals-from calendar-management.js */
/* import-globals-from calendar-modes.js */
/* import-globals-from calendar-task-tree-utils.js */
/* import-globals-from calendar-ui-utils.js */
/* import-globals-from calendar-unifinder.js */
/* import-globals-from calendar-views-utils.js */
/* import-globals-from import-export.js */

/* globals goSetMenuValue, switchCalendarView */

var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { cal } = ChromeUtils.import("resource:///modules/calendar/calUtils.jsm");

/* exported injectCalendarCommandController, removeCalendarCommandController,
 *          setupContextItemType, getSelectedItems,
 *          deleteSelectedItems, calendarUpdateNewItemsCommand
 */

var CalendarDeleteCommandEnabled = false;
var CalendarNewEventsCommandEnabled = false;
var CalendarNewTasksCommandEnabled = false;

/**
 * Command controller to execute calendar specific commands
 * @see nsICommandController
 */
var calendarController = {
  defaultController: null,

  commands: new Set([
    // Common commands
    "calendar_new_event_command",
    "calendar_new_event_context_command",
    "calendar_modify_event_command",
    "calendar_delete_event_command",

    "calendar_modify_focused_item_command",
    "calendar_delete_focused_item_command",

    "calendar_new_todo_command",
    "calendar_new_todo_context_command",
    "calendar_new_todo_todaypane_command",
    "calendar_modify_todo_command",
    "calendar_modify_todo_todaypane_command",
    "calendar_delete_todo_command",

    "calendar_new_calendar_command",
    "calendar_edit_calendar_command",
    "calendar_delete_calendar_command",

    "calendar_import_command",
    "calendar_export_command",
    "calendar_export_selection_command",

    "calendar_publish_selected_calendar_command",
    "calendar_publish_calendar_command",
    "calendar_publish_selected_events_command",

    "calendar_view_next_command",
    "calendar_view_prev_command",

    "calendar_toggle_orientation_command",
    "calendar_toggle_workdays_only_command",

    "calendar_day-view_command",
    "calendar_week-view_command",
    "calendar_multiweek-view_command",
    "calendar_month-view_command",

    "calendar_task_filter_command",
    "calendar_task_filter_todaypane_command",
    "calendar_reload_remote_calendars",
    "calendar_show_unifinder_command",
    "calendar_toggle_completed_command",
    "calendar_percentComplete-0_command",
    "calendar_percentComplete-25_command",
    "calendar_percentComplete-50_command",
    "calendar_percentComplete-75_command",
    "calendar_percentComplete-100_command",
    "calendar_priority-0_command",
    "calendar_priority-9_command",
    "calendar_priority-5_command",
    "calendar_priority-1_command",
    "calendar_general-priority_command",
    "calendar_general-progress_command",
    "calendar_general-postpone_command",
    "calendar_postpone-1hour_command",
    "calendar_postpone-1day_command",
    "calendar_postpone-1week_command",
    "calendar_task_category_command",

    "calendar_attendance_command",

    // for events/tasks in a tab
    "cmd_save",
    "cmd_accept",

    // Pseudo commands
    "calendar_in_foreground",
    "calendar_in_background",
    "calendar_mode_calendar",
    "calendar_mode_task",

    "cmd_selectAll",
  ]),

  updateCommands() {
    this.commands.forEach(goUpdateCommand);
  },

  supportsCommand(aCommand) {
    if (this.commands.has(aCommand)) {
      return true;
    }
    if (this.defaultContoller) {
      return this.defaultContoller.supportsCommand(aCommand);
    }
    return false;
  },

  /* eslint-disable complexity */
  isCommandEnabled(aCommand) {
    switch (aCommand) {
      case "calendar_new_event_command":
      case "calendar_new_event_context_command":
      case "calendar_new_event_todaypane_command":
        return CalendarNewEventsCommandEnabled;
      case "calendar_modify_focused_item_command":
        return this.item_selected;
      case "calendar_modify_event_command":
        return this.item_selected;
      case "calendar_delete_focused_item_command":
        return CalendarDeleteCommandEnabled && this.selected_items_writable;
      case "calendar_delete_event_command":
        return CalendarDeleteCommandEnabled && this.selected_items_writable;
      case "calendar_new_todo_command":
      case "calendar_new_todo_context_command":
      case "calendar_new_todo_todaypane_command":
        return CalendarNewTasksCommandEnabled;
      case "calendar_modify_todo_command":
      case "calendar_modify_todo_todaypane_command":
        return this.todo_items_selected;
      // This code is temporarily commented out due to
      // bug 469684 Unifinder-todo: raising of the context menu fires blur-event
      // this.todo_tasktree_focused;
      case "calendar_edit_calendar_command":
        return this.isCalendarInForeground();
      case "calendar_task_filter_command":
        return true;
      case "calendar_delete_todo_command":
        if (!CalendarDeleteCommandEnabled) {
          return false;
        }
      // falls through otherwise
      case "calendar_toggle_completed_command":
      case "calendar_percentComplete-0_command":
      case "calendar_percentComplete-25_command":
      case "calendar_percentComplete-50_command":
      case "calendar_percentComplete-75_command":
      case "calendar_percentComplete-100_command":
      case "calendar_priority-0_command":
      case "calendar_priority-9_command":
      case "calendar_priority-5_command":
      case "calendar_priority-1_command":
      case "calendar_task_category_command":
      case "calendar_general-progress_command":
      case "calendar_general-priority_command":
      case "calendar_general-postpone_command":
      case "calendar_postpone-1hour_command":
      case "calendar_postpone-1day_command":
      case "calendar_postpone-1week_command":
        return (
          ((this.isCalendarInForeground() || this.todo_tasktree_focused) &&
            this.writable &&
            this.todo_items_selected &&
            this.todo_items_writable) ||
          document.getElementById("tabmail").currentTabInfo.mode.type == "calendarTask"
        );
      case "calendar_delete_calendar_command":
        return this.isCalendarInForeground() && !this.last_calendar;
      case "calendar_import_command":
        return this.writable;
      case "calendar_export_selection_command":
        return this.item_selected;
      case "calendar_toggle_orientation_command":
        return this.isInMode("calendar") && currentView().supportsRotation;
      case "calendar_toggle_workdays_only_command":
        return this.isInMode("calendar") && currentView().supportsWorkdaysOnly;
      case "calendar_publish_selected_events_command":
        return this.item_selected;

      case "calendar_reload_remote_calendars":
        return this.has_enabled_reloadable_calendars && !this.offline;
      case "calendar_attendance_command": {
        let attendSel = false;
        if (this.todo_tasktree_focused) {
          attendSel =
            this.writable &&
            this.todo_items_invitation &&
            this.todo_items_selected &&
            this.todo_items_writable;
        } else {
          attendSel =
            this.item_selected && this.selected_events_invitation && this.selected_items_writable;
        }

        // Small hack, we want to hide instead of disable.
        setBooleanAttribute("calendar_attendance_command", "hidden", !attendSel);
        return attendSel;
      }

      // The following commands all just need the calendar in foreground,
      // make sure you take care when changing things here.
      case "calendar_view_next_command":
      case "calendar_view_prev_command":
      case "calendar_in_foreground":
        return this.isCalendarInForeground();
      case "calendar_in_background":
        return !this.isCalendarInForeground();

      // The following commands need calendar mode, be careful when
      // changing things.
      case "calendar_day-view_command":
      case "calendar_week-view_command":
      case "calendar_multiweek-view_command":
      case "calendar_month-view_command":
      case "calendar_show_unifinder_command":
      case "calendar_mode_calendar":
        return this.isInMode("calendar");

      case "calendar_mode_task":
        return this.isInMode("task");

      case "cmd_selectAll":
        if (this.todo_tasktree_focused || this.isInMode("calendar")) {
          return true;
        } else if (this.defaultController.supportsCommand(aCommand)) {
          return this.defaultController.isCommandEnabled(aCommand);
        }
        break;

      // for events/tasks in a tab
      case "cmd_save":
      // falls through
      case "cmd_accept": {
        let tabType = document.getElementById("tabmail").currentTabInfo.mode.type;
        return tabType == "calendarTask" || tabType == "calendarEvent";
      }

      default:
        if (this.defaultController && !this.isCalendarInForeground()) {
          // The delete-button demands a special handling in mail-mode
          // as it is supposed to delete an element of the focused pane
          if (aCommand == "cmd_delete" || aCommand == "button_delete") {
            let focusedElement = document.commandDispatcher.focusedElement;
            if (focusedElement) {
              if (focusedElement.getAttribute("id") == "agenda-listbox") {
                return agendaListbox.isEventSelected();
              } else if (focusedElement.className == "calendar-task-tree") {
                return this.writable && this.todo_items_selected && this.todo_items_writable;
              }
            }
          }

          if (this.defaultController.supportsCommand(aCommand)) {
            return this.defaultController.isCommandEnabled(aCommand);
          }
        }
        if (this.commands.has(aCommand)) {
          // All other commands we support should be enabled by default
          return true;
        }
    }
    return false;
  },
  /* eslint-enable complexity */

  doCommand(aCommand) {
    switch (aCommand) {
      // Common Commands
      case "calendar_new_event_command":
        createEventWithDialog(
          getSelectedCalendar(),
          cal.dtz.getDefaultStartDate(currentView().selectedDay)
        );
        break;
      case "calendar_new_event_context_command": {
        let newStart = currentView().selectedDateTime;
        if (!newStart) {
          newStart = cal.dtz.getDefaultStartDate(currentView().selectedDay);
        }
        createEventWithDialog(getSelectedCalendar(), newStart, null, null, null, newStart.isDate);
        break;
      }
      case "calendar_modify_event_command":
        editSelectedEvents();
        break;
      case "calendar_modify_focused_item_command": {
        let focusedElement = document.commandDispatcher.focusedElement;
        if (!focusedElement && this.defaultController && !this.isCalendarInForeground()) {
          this.defaultController.doCommand(aCommand);
        } else {
          let focusedRichListbox = cal.view.getParentNodeOrThis(focusedElement, "richlistbox");
          if (focusedRichListbox && focusedRichListbox.id == "agenda-listbox") {
            agendaListbox.editSelectedItem();
          } else if (focusedElement && focusedElement.className == "calendar-task-tree") {
            modifyTaskFromContext();
          } else if (this.isInMode("calendar")) {
            editSelectedEvents();
          }
        }
        break;
      }
      case "calendar_delete_event_command":
        deleteSelectedEvents();
        break;
      case "calendar_delete_focused_item_command": {
        let focusedElement = document.commandDispatcher.focusedElement;
        if (!focusedElement && this.defaultController && !this.isCalendarInForeground()) {
          this.defaultController.doCommand(aCommand);
        } else {
          let focusedRichListbox = cal.view.getParentNodeOrThis(focusedElement, "richlistbox");
          if (focusedRichListbox && focusedRichListbox.id == "agenda-listbox") {
            agendaListbox.deleteSelectedItem(false);
          } else if (focusedElement && focusedElement.className == "calendar-task-tree") {
            deleteToDoCommand(null, false);
          } else if (this.isInMode("calendar")) {
            deleteSelectedEvents();
          }
        }
        break;
      }
      case "calendar_new_todo_command":
        createTodoWithDialog(
          getSelectedCalendar(),
          null,
          null,
          null,
          cal.dtz.getDefaultStartDate(currentView().selectedDay)
        );
        break;
      case "calendar_new_todo_context_command": {
        let initialDate = currentView().selectedDateTime;
        if (!initialDate || initialDate.isDate) {
          initialDate = cal.dtz.getDefaultStartDate(currentView().selectedDay);
        }
        createTodoWithDialog(getSelectedCalendar(), null, null, null, initialDate);
        break;
      }
      case "calendar_new_todo_todaypane_command":
        createTodoWithDialog(
          getSelectedCalendar(),
          null,
          null,
          null,
          cal.dtz.getDefaultStartDate(agendaListbox.today.start)
        );
        break;
      case "calendar_delete_todo_command":
        deleteToDoCommand();
        break;
      case "calendar_modify_todo_command":
        modifyTaskFromContext(null, cal.dtz.getDefaultStartDate(currentView().selectedDay));
        break;
      case "calendar_modify_todo_todaypane_command":
        modifyTaskFromContext(null, cal.dtz.getDefaultStartDate(agendaListbox.today.start));
        break;

      case "calendar_new_calendar_command":
        cal.window.openCalendarWizard(window);
        break;
      case "calendar_edit_calendar_command":
        cal.window.openCalendarProperties(window, getSelectedCalendar());
        break;
      case "calendar_delete_calendar_command":
        promptDeleteCalendar(getSelectedCalendar());
        break;

      case "calendar_import_command":
        loadEventsFromFile();
        break;
      case "calendar_export_command":
        exportEntireCalendar();
        break;
      case "calendar_export_selection_command":
        saveEventsToFile(currentView().getSelectedItems());
        break;

      case "calendar_publish_selected_calendar_command":
        publishEntireCalendar(getSelectedCalendar());
        break;
      case "calendar_publish_calendar_command":
        publishEntireCalendar();
        break;
      case "calendar_publish_selected_events_command":
        publishCalendarData();
        break;

      case "calendar_reload_remote_calendars":
        cal.view.getCompositeCalendar(window).refresh();
        break;
      case "calendar_show_unifinder_command":
        toggleUnifinder();
        break;
      case "calendar_view_next_command":
        currentView().moveView(1);
        break;
      case "calendar_view_prev_command":
        currentView().moveView(-1);
        break;
      case "calendar_toggle_orientation_command":
        toggleOrientation();
        break;
      case "calendar_toggle_workdays_only_command":
        toggleWorkdaysOnly();
        break;

      case "calendar_day-view_command":
        switchCalendarView("day", true);
        break;
      case "calendar_week-view_command":
        switchCalendarView("week", true);
        break;
      case "calendar_multiweek-view_command":
        switchCalendarView("multiweek", true);
        break;
      case "calendar_month-view_command":
        switchCalendarView("month", true);
        break;
      case "calendar_attendance_command":
        // This command is actually handled inline, since it takes a value
        break;

      case "cmd_selectAll":
        if (
          !this.todo_tasktree_focused &&
          this.defaultController &&
          !this.isCalendarInForeground()
        ) {
          // Unless a task tree is focused, make the default controller
          // take care.
          this.defaultController.doCommand(aCommand);
        } else if (this.todo_tasktree_focused) {
          getTaskTree().selectAll();
        } else if (this.isInMode("calendar")) {
          selectAllEvents();
        }
        break;

      default:
        if (this.defaultController && !this.isCalendarInForeground()) {
          // If calendar is not in foreground, let the default controller take
          // care. If we don't have a default controller, just continue.
          this.defaultController.doCommand(aCommand);
        }
    }
  },

  onEvent(aEvent) {},

  isCalendarInForeground() {
    return gCurrentMode && gCurrentMode != "mail";
  },

  isInMode(mode) {
    switch (mode) {
      case "mail":
        return !this.isCalendarInForeground();
      case "calendar":
        return gCurrentMode && gCurrentMode == "calendar";
      case "task":
        return gCurrentMode && gCurrentMode == "task";
    }
    return false;
  },

  onSelectionChanged(aEvent) {
    let selectedItems = aEvent.detail;

    calendarUpdateDeleteCommand(selectedItems);
    calendarController.item_selected = selectedItems && selectedItems.length > 0;

    let selLength = selectedItems === undefined ? 0 : selectedItems.length;
    let selected_events_readonly = 0;
    let selected_events_requires_network = 0;
    let selected_events_invitation = 0;

    if (selLength > 0) {
      for (let item of selectedItems) {
        if (item.calendar.readOnly) {
          selected_events_readonly++;
        }
        if (
          item.calendar.getProperty("requiresNetwork") &&
          !item.calendar.getProperty("cache.enabled") &&
          !item.calendar.getProperty("cache.always")
        ) {
          selected_events_requires_network++;
        }

        if (cal.itip.isInvitation(item)) {
          selected_events_invitation++;
        } else if (item.organizer) {
          // If we are the organizer and there are attendees, then
          // this is likely also an invitation.
          let calOrgId = item.calendar.getProperty("organizerId");
          if (item.organizer.id == calOrgId && item.getAttendees().length) {
            selected_events_invitation++;
          }
        }
      }
    }

    calendarController.selected_events_readonly = selected_events_readonly == selLength;

    calendarController.selected_events_requires_network =
      selected_events_requires_network == selLength;
    calendarController.selected_events_invitation = selected_events_invitation == selLength;

    calendarController.updateCommands();
    calendarController2.updateCommands();
    document.commandDispatcher.updateCommands("mail-toolbar");
  },

  /**
   * Condition Helpers
   */

  // These attributes will be set up manually.
  item_selected: false,
  selected_events_readonly: false,
  selected_events_requires_network: false,
  selected_events_invitation: false,

  /**
   * Returns a boolean indicating if its possible to write items to any
   * calendar.
   */
  get writable() {
    return cal
      .getCalendarManager()
      .getCalendars()
      .some(cal.acl.isCalendarWritable);
  },

  /**
   * Returns a boolean indicating if the application is currently in offline
   * mode.
   */
  get offline() {
    return Services.io.offline;
  },

  /**
   * Returns a boolean indicating if all calendars are readonly.
   */
  get all_readonly() {
    let calMgr = cal.getCalendarManager();
    return calMgr.readOnlyCalendarCount == calMgr.calendarCount;
  },

  /**
   * Returns a boolean indicating whether there is at least one enabled
   * calendar that can be reloaded. Note: ICS calendars can have a network URL
   * or a file URL, but both are reloadable.
   */
  get has_enabled_reloadable_calendars() {
    return cal
      .getCalendarManager()
      .getCalendars()
      .some(
        calendar =>
          !calendar.getProperty("disabled") &&
          (calendar.type == "ics" || calendar.getProperty("requiresNetwork") !== false)
      );
  },

  /**
   * Returns a boolean indicating if there are calendars that don't require
   * network access.
   */
  get has_local_calendars() {
    let calMgr = cal.getCalendarManager();
    return calMgr.networkCalendarCount < calMgr.calendarCount;
  },

  /**
   * Returns a boolean indicating if there are cached calendars and thus that don't require
   * network access.
   */
  get has_cached_calendars() {
    let calMgr = cal.getCalendarManager();
    let calendars = calMgr.getCalendars();
    for (let calendar of calendars) {
      if (calendar.getProperty("cache.enabled") || calendar.getProperty("cache.always")) {
        return true;
      }
    }
    return false;
  },

  /**
   * Returns a boolean indicating that there is only one calendar left.
   */
  get last_calendar() {
    return cal.getCalendarManager().calendarCount < 2;
  },

  /**
   * Returns a boolean indicating that all local calendars are readonly
   */
  get all_local_calendars_readonly() {
    // We might want to speed this part up by keeping track of this in the
    // calendar manager.
    let calendars = cal.getCalendarManager().getCalendars();
    let count = calendars.length;
    for (let calendar of calendars) {
      if (!cal.acl.isCalendarWritable(calendar)) {
        count--;
      }
    }
    return count == 0;
  },

  /**
   * Returns a boolean indicating that at least one of the items selected
   * in the current view has a writable calendar.
   */
  get selected_items_writable() {
    return (
      this.writable &&
      this.item_selected &&
      !this.selected_events_readonly &&
      (!this.offline || !this.selected_events_requires_network)
    );
  },

  /**
   * Returns a boolean indicating that tasks are selected.
   */
  get todo_items_selected() {
    let selectedTasks = getSelectedTasks();
    return selectedTasks.length > 0;
  },

  get todo_items_invitation() {
    let selectedTasks = getSelectedTasks();
    let selected_tasks_invitation = 0;

    for (let item of selectedTasks) {
      if (cal.itip.isInvitation(item)) {
        selected_tasks_invitation++;
      } else if (item.organizer) {
        // If we are the organizer and there are attendees, then
        // this is likely also an invitation.
        let calOrgId = item.calendar.getProperty("organizerId");
        if (item.organizer.id == calOrgId && item.getAttendees().length) {
          selected_tasks_invitation++;
        }
      }
    }

    return selectedTasks.length == selected_tasks_invitation;
  },

  /**
   * Returns a boolean indicating that at least one task in the selection is
   * on a calendar that is writable.
   */
  get todo_items_writable() {
    let selectedTasks = getSelectedTasks();
    for (let task of selectedTasks) {
      if (cal.acl.isCalendarWritable(task.calendar)) {
        return true;
      }
    }
    return false;
  },
};

/**
 * XXX This is a temporary hack so we can release 1.0b2. This will soon be
 * superseded by a new command controller architecture.
 */
var calendarController2 = {
  defaultController: null,

  commands: new Set([
    "cmd_cut",
    "cmd_copy",
    "cmd_paste",
    "cmd_undo",
    "cmd_redo",
    "cmd_print",
    "cmd_pageSetup",

    "cmd_printpreview",
    "button_print",
    "button_delete",
    "cmd_delete",
    "cmd_properties",
    "cmd_goForward",
    "cmd_goBack",
    "cmd_fullZoomReduce",
    "cmd_fullZoomEnlarge",
    "cmd_fullZoomReset",
    "cmd_showQuickFilterBar",
  ]),

  // These functions can use the same from the calendar controller for now.
  updateCommands: calendarController.updateCommands,
  supportsCommand: calendarController.supportsCommand,
  onEvent: calendarController.onEvent,

  isCommandEnabled(aCommand) {
    switch (aCommand) {
      // Thunderbird Commands
      case "cmd_cut":
        return calendarController.selected_items_writable;
      case "cmd_copy":
        return calendarController.item_selected;
      case "cmd_paste":
        return canPaste();
      case "cmd_undo":
        goSetMenuValue(aCommand, "valueDefault");
        return canUndo();
      case "cmd_redo":
        goSetMenuValue(aCommand, "valueDefault");
        return canRedo();
      case "button_delete":
      case "cmd_delete":
        return calendarController.isCommandEnabled("calendar_delete_focused_item_command");
      case "cmd_fullZoomReduce":
      case "cmd_fullZoomEnlarge":
      case "cmd_fullZoomReset":
        return calendarController.isInMode("calendar") && currentView().supportsZoom;
      case "cmd_properties":
      case "cmd_printpreview":
        return false;
      case "cmd_showQuickFilterBar":
        return calendarController.isInMode("task");
      default:
        return true;
    }
  },

  doCommand(aCommand) {
    if (!this.isCommandEnabled(aCommand)) {
      // doCommand is triggered for cmd_cut even if the command is disabled
      // so we bail out here
      return;
    }
    switch (aCommand) {
      case "cmd_cut":
        cutToClipboard();
        break;
      case "cmd_copy":
        copyToClipboard();
        break;
      case "cmd_paste":
        pasteFromClipboard();
        break;
      case "cmd_undo":
        undo();
        break;
      case "cmd_redo":
        redo();
        break;
      case "cmd_pageSetup":
        PrintUtils.showPageSetup();
        break;
      case "button_print":
      case "cmd_print":
        cal.window.openPrintDialog(window);
        break;

      // Thunderbird commands
      case "cmd_goForward":
        currentView().moveView(1);
        break;
      case "cmd_goBack":
        currentView().moveView(-1);
        break;
      case "cmd_fullZoomReduce":
        currentView().zoomIn();
        break;
      case "cmd_fullZoomEnlarge":
        currentView().zoomOut();
        break;
      case "cmd_fullZoomReset":
        currentView().zoomReset();
        break;
      case "cmd_showQuickFilterBar":
        document.getElementById("task-text-filter-field").select();
        break;

      case "button_delete":
      case "cmd_delete":
        calendarController.doCommand("calendar_delete_focused_item_command");
        break;
    }
  },
};

/**
 * Inserts the command controller into the document. On Lightning, also make
 * sure that it is inserted before the conflicting Thunderbird command
 * controller.
 */
function injectCalendarCommandController() {
  calendarController.defaultController = document.getElementById("tabmail").tabController;
  top.controllers.insertControllerAt(0, calendarController);
  document.commandDispatcher.updateCommands("calendar_commands");
}

/**
 * Remove the calendar command controller from the document.
 */
function removeCalendarCommandController() {
  top.controllers.removeController(calendarController);
}

/**
 * Handler function to set up the item context menu, depending on the given
 * items. Changes the delete menuitem to fit the passed items.
 *
 * @param  {DOMEvent}              aEvent   The DOM popupshowing event that is
 *                                   triggered by opening the context menu
 * @param  {Array.<calIItemBase>}  aItems   An array of items (usually the selected
 *                                            items) to adapt the context menu for
 * @return {Boolean}                        True, to show the popup menu.
 */
function setupContextItemType(aEvent, aItems) {
  function adaptModificationMenuItem(aMenuItemId, aItemType) {
    let menuItem = document.getElementById(aMenuItemId);
    if (menuItem) {
      menuItem.setAttribute("label", cal.l10n.getCalString(`delete${aItemType}Label`));
      menuItem.setAttribute("accesskey", cal.l10n.getCalString(`delete${aItemType}Accesskey`));
    }
  }
  if (aItems.some(cal.item.isEvent) && aItems.some(cal.item.isToDo)) {
    aEvent.target.setAttribute("type", "mixed");
    adaptModificationMenuItem("calendar-item-context-menu-delete-menuitem", "Item");
  } else if (aItems.length && cal.item.isEvent(aItems[0])) {
    aEvent.target.setAttribute("type", "event");
    adaptModificationMenuItem("calendar-item-context-menu-delete-menuitem", "Event");
  } else if (aItems.length && cal.item.isToDo(aItems[0])) {
    aEvent.target.setAttribute("type", "todo");
    adaptModificationMenuItem("calendar-item-context-menu-delete-menuitem", "Task");
  } else {
    aEvent.target.removeAttribute("type");
    adaptModificationMenuItem("calendar-item-context-menu-delete-menuitem", "Item");
  }

  let menu = document.getElementById("calendar-item-context-menu-attendance-menu");
  setupAttendanceMenu(menu, aItems);

  return true;
}

/**
 * Returns the selected items, based on which mode we are currently in and what task tree is focused.
 */
function getSelectedItems() {
  if (calendarController.todo_tasktree_focused) {
    return getSelectedTasks();
  }

  return currentView().getSelectedItems();
}

/**
 * Deletes the selected items, based on which mode we are currently in and what task tree is focused
 */
function deleteSelectedItems() {
  if (calendarController.todo_tasktree_focused) {
    deleteToDoCommand();
  } else if (calendarController.isInMode("calendar")) {
    deleteSelectedEvents();
  }
}

function calendarUpdateNewItemsCommand() {
  // Re-calculate command status.
  let calendars = cal
    .getCalendarManager()
    .getCalendars()
    .filter(cal.acl.isCalendarWritable)
    .filter(cal.acl.userCanAddItemsToCalendar);

  CalendarNewEventsCommandEnabled = calendars.some(cal.item.isEventCalendar);
  CalendarNewTasksCommandEnabled = calendars.some(cal.item.isTaskCalendar);

  [
    "calendar_new_event_command",
    "calendar_new_event_context_command",
    "calendar_new_todo_command",
    "calendar_new_todo_context_command",
    "calendar_new_todo_todaypane_command",
  ].forEach(goUpdateCommand);
}

function calendarUpdateDeleteCommand(selectedItems) {
  let oldValue = CalendarDeleteCommandEnabled;
  CalendarDeleteCommandEnabled = selectedItems.length > 0;

  /* we must disable "delete" when at least one item cannot be deleted */
  for (let item of selectedItems) {
    if (!cal.acl.userCanDeleteItemsFromCalendar(item.calendar)) {
      CalendarDeleteCommandEnabled = false;
      break;
    }
  }

  if (CalendarDeleteCommandEnabled != oldValue) {
    [
      "calendar_delete_event_command",
      "calendar_delete_todo_command",
      "calendar_delete_focused_item_command",
      "button_delete",
      "cmd_delete",
    ].forEach(goUpdateCommand);
  }
}
