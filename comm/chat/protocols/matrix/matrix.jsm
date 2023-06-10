/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var EXPORTED_SYMBOLS = ["MatrixProtocol"];

var {
  XPCOMUtils,
  EmptyEnumerator,
  nsSimpleEnumerator,
  l10nHelper,
  setTimeout,
  clearTimeout,
} = ChromeUtils.import("resource:///modules/imXPCOMUtils.jsm");
var { Services } = ChromeUtils.import("resource:///modules/imServices.jsm");
var {
  GenericAccountPrototype,
  GenericConvChatPrototype,
  GenericConvChatBuddyPrototype,
  GenericProtocolPrototype,
  GenericConversationPrototype,
  GenericConvIMPrototype,
  TooltipInfo,
} = ChromeUtils.import("resource:///modules/jsProtoHelper.jsm");

Cu.importGlobalProperties(["indexedDB"]);

XPCOMUtils.defineLazyGetter(this, "_", () =>
  l10nHelper("chrome://chat/locale/matrix.properties")
);

ChromeUtils.defineModuleGetter(
  this,
  "MatrixSDK",
  "resource:///modules/matrix-sdk.jsm"
);

ChromeUtils.defineModuleGetter(
  this,
  "getHttpUriForMxc",
  "resource:///modules/matrix-sdk.jsm"
);

ChromeUtils.defineModuleGetter(
  this,
  "DownloadUtils",
  "resource://gre/modules/DownloadUtils.jsm"
);

function MatrixParticipant(roomMember, account) {
  this._id = roomMember.userId;
  this._roomMember = roomMember;
  this._account = account;
}
MatrixParticipant.prototype = {
  __proto__: GenericConvChatBuddyPrototype,
  get alias() {
    return this._roomMember.name;
  },
  get name() {
    return this._id;
  },

  get buddyIconFilename() {
    if (this._roomMember.user && this._roomMember.user.avatarUrl) {
      return this._roomMember.getAvatarUrl(this._account._baseURL) || "";
    }
    return "";
  },

  // See https://matrix.org/docs/spec/client_server/r0.5.0#m-room-power-levels
  get voiced() {
    return this._roomMember.powerLevelNorm >= 10;
  },
  get halfOp() {
    return this._roomMember.powerLevelNorm >= 25;
  },
  get op() {
    return this._roomMember.powerLevelNorm >= 50;
  },
  get founder() {
    return this._roomMember.powerLevelNorm == 100;
  },
};

let GenericMatrixConversation = {
  /*
   * Leave the room if we close the conversation.
   */
  close() {
    this._account._client.leave(this._roomId);
    this._account.roomList.delete(this._roomId);
    GenericConversationPrototype.close.call(this);
  },

  sendMsg(msg) {
    let content = {
      body: msg,
      msgtype: "m.text",
    };
    this._account._client.sendEvent(
      this._roomId,
      "m.room.message",
      content,
      "",
      (err, res) => {
        if (err) {
          this._account.ERROR("Failed to send message to: " + this._roomId);
        } else {
          // If there's no error, display the message to the user.
        }
      }
    );
  },

  /*
   * Shared init function between MatrixDirectConversation and MatrixConversation.
   *
   * @param {Object} room - associated room with the conversation.
   */
  sharedInitRoom(room) {
    if (!room) {
      return;
    }
    // Store the ID of the room to look up information in the future.
    this._roomId = room.roomId;

    // Update the title to the human readable version.
    if (
      room.summary &&
      room.summary.info &&
      room.summary.info.title &&
      this._name != room.summary.info.title
    ) {
      this._name = room.summary.info.title;
      this.notifyObservers(null, "update-conv-title");
    }
  },
};

/*
 * TODO Other functionality from MatrixClient to implement:
 *  sendNotice
 *  sendReadReceipt
 *  sendTyping
 *  setPowerLevel
 *  setRoomTopic
 */
function MatrixConversation(account, name, nick) {
  this._init(account, name, nick);
}
MatrixConversation.prototype = {
  __proto__: GenericConvChatPrototype,

  get room() {
    return this._account._client.getRoom(this._roomId);
  },
  addParticipant(roomMember) {
    if (this._participants.has(roomMember.userId)) {
      return;
    }

    let participant = new MatrixParticipant(roomMember, this._account);
    this._participants.set(roomMember.userId, participant);
    this.notifyObservers(
      new nsSimpleEnumerator([participant]),
      "chat-buddy-add"
    );
  },

  removeParticipant(roomMember) {
    if (!this._participants.has(roomMember.userId)) {
      return;
    }
    let participant = this._participants.get(roomMember.userId);
    this._participants.delete(roomMember.userId);
    this.notifyObservers(
      new nsSimpleEnumerator([participant]),
      "chat-buddy-remove"
    );
  },

  /*
   * Initialize the room after the response from the Matrix client.
   *
   * @param {Object} room - associated room with the conversation.
   */
  initRoom(room) {
    this.sharedInitRoom(room);

    // If there are any participants, create them.
    let participants = [];
    room.getJoinedMembers().forEach(roomMember => {
      if (!this._participants.has(roomMember.userId)) {
        let participant = new MatrixParticipant(roomMember, this._account);
        participants.push(participant);
        this._participants.set(roomMember.userId, participant);
      }
    });
    if (participants.length) {
      this.notifyObservers(
        new nsSimpleEnumerator(participants),
        "chat-buddy-add"
      );
    }

    if (room.currentState.getStateEvents("m.room.topic").length) {
      let event = room.currentState.getStateEvents("m.room.topic")[0];
      this.setTopic(event.getContent().topic, event.getSender().name, true);
    }
  },

  get topic() {
    return this._topic;
  },

  set topic(aTopic) {
    // Check if our user has the permissions to set the topic.
    if (this.topicSettable) {
      this._account._client.setRoomTopic(this._roomId, aTopic);
    }
  },

  get topicSettable() {
    return (
      this.room &&
      this.room.currentState.maySendEvent("m.room.topic", this._account.userId)
    );
  },
};
Object.assign(MatrixConversation.prototype, GenericMatrixConversation);

function MatrixDirectConversation(account, name) {
  this._init(account, name);
}
MatrixDirectConversation.prototype = {
  __proto__: GenericConvIMPrototype,

  /*
   * Initialize the room after the response from the Matrix client.
   *
   * @param {Object} room - associated room with the conversation.
   */
  initRoom(room) {
    this.sharedInitRoom(room);
  },

  get room() {
    return this._account._client.getRoom(this._roomId);
  },

  _typingTimer: null,
  _typingState: false,
  get shouldSendTypingNotifications() {
    return Services.prefs.getBoolPref("purple.conversations.im.send_typing");
  },

  sendTyping(string) {
    if (!this.shouldSendTypingNotifications) {
      return Ci.prplIConversation.NO_TYPING_LIMIT;
    }

    this._cancelTypingTimer();
    if (string.length) {
      this._typingTimer = setTimeout(this.finishedComposing.bind(this), 10000);
    }

    this._setTypingState(!!string.length);

    return Ci.prplIConversation.NO_TYPING_LIMIT;
  },

  finishedComposing() {
    if (!this.shouldSendTypingNotifications) {
      return;
    }

    this._setTypingState(false);
  },

  _setTypingState(isTyping) {
    if (this._typingState == isTyping) {
      return;
    }

    this._account._client.sendTyping(this._roomId, isTyping);
    this._typingState = isTyping;
  },
  _cancelTypingTimer() {
    if (this._typingTimer) {
      clearTimeout(this._typingTimer);
      delete this._typingTimer;
    }
  },
};
Object.assign(MatrixDirectConversation.prototype, GenericMatrixConversation);

/*
 * TODO Other random functionality from MatrixClient that will be useful:
 *  getRooms / getUsers / publicRooms
 *  invite
 *  ban / kick
 *  leave
 *  redactEvent
 *  scrollback
 *  setAvatarUrl
 *  setDisplayName
 *  setPassword
 *  setPresence
 */
function MatrixAccount(aProtocol, aImAccount) {
  this._init(aProtocol, aImAccount);
  this.roomList = new Map();
  this._userToRoom = new Set();
}
MatrixAccount.prototype = {
  __proto__: GenericAccountPrototype,
  observe(aSubject, aTopic, aData) {},
  remove() {
    for (let conv of this.roomList.values()) {
      // We want to remove all the conversations. We are not using conv.close
      // function call because we don't want user to leave all the matrix rooms.
      // User just want to remove the account so we need to remove the listed
      // conversations. GenericConversationPrototype.close is used at various
      // places in the file. It's because of the same reason, we want to remove
      // the conversation only, don't want user to leave the room. conv.close
      // function call will make user leave the room and close the conversation.
      GenericConversationPrototype.close.call(conv);
    }
    delete this.roomList;
    // We want to clear data stored for syncing in indexedDB so when
    // user logins again, one gets the fresh start.
    this._client.clearStores();
  },
  unInit() {},
  connect() {
    this.reportConnecting();
    let dbName = "chat:matrix:" + this.imAccount.id;
    this._baseURL = this.getString("server") + ":" + this.getInt("port");

    const opts = {
      useAuthorizationHeader: true,
      baseUrl: this._baseURL,
      store: new MatrixSDK.IndexedDBStore({
        indexedDB,
        dbName,
      }),
    };

    opts.store.startup().then(() => {
      this._client = MatrixSDK.createClient(opts);
      this._client
        .loginWithPassword(this.name, this.imAccount.password)
        .then(data => {
          // TODO: Check data.errcode to pass more accurate value as the first
          // parameter of reportDisconnecting.
          if (data.error) {
            throw new Error(data.error);
          }
          this.startClient();
        })
        .catch(error => {
          this.reportDisconnecting(
            Ci.prplIAccount.ERROR_OTHER_ERROR,
            error.message
          );
          this.reportDisconnected();
        });
    });
  },
  /*
   * Hook up the Matrix Client to callbacks to handle various events.
   *
   * The possible events are documented starting at:
   * https://matrix-org.github.io/matrix-js-sdk/2.4.1/module-client.html#~event:MatrixClient%22accountData%22
   */
  startClient() {
    this._client.on("sync", (state, prevState, data) => {
      switch (state) {
        case "PREPARED":
          this.reportConnected();
          break;
        case "STOPPED":
          this._client.logout().then(() => {
            this.reportDisconnected();
          });
          break;
        // TODO: Handle other states (RECONNECTING, ERROR, SYNCING).
      }
    });
    this._client.on("RoomMember.membership", (event, member, oldMembership) => {
      if (this.roomList.has(member.roomId)) {
        let conv = this.roomList.get(member.roomId);
        if (conv.isChat) {
          if (member.membership === "join") {
            conv.addParticipant(member);
          } else if (member.membership === "leave") {
            conv.removeParticipant(member.userId);
          }
        }
        // If we are leaving the room, remove the conversation. If any user gets
        // added or removed in the direct chat, update the conversation type. We
        // are treating the direct chat with two people as a direct conversation
        // only. Matrix supports multiple users in the direct chat. So we will
        // treat all the rooms which have 2 users including us and classified as
        // a DM room by SDK a direct conversation and all other rooms as a group
        // conversations.
        if (member.membership === "leave" && member.userId == this.userId) {
          this.roomList.delete(member.roomId);
          GenericConversationPrototype.close.call(conv);
        } else if (
          member.membership === "join" ||
          member.membership === "leave"
        ) {
          this.checkRoomForUpdate(conv);
        }
      }
    });

    /*
     * Get the map of direct messaging rooms.
     */
    this._client.on("accountData", event => {
      if (event.getType() == "m.direct") {
        this._userToRoom = event.getContent();
      }
    });

    this._client.on(
      "Room.timeline",
      (event, room, toStartOfTimeline, removed, data) => {
        if (toStartOfTimeline) {
          return;
        }
        let conv = this.roomList.get(room.roomId);
        if (!conv) {
          return;
        }
        if (event.getType() === "m.room.message") {
          conv.writeMessage(event.sender.name, event.getContent().body, {
            incoming: true,
          });
        } else if (event.getType() == "m.room.topic") {
          conv.setTopic(event.getContent().topic, event.sender.name);
        } else if (conv && event.getType() == "m.room.power_levels") {
          conv.notifyObservers(null, "chat-update-topic");
          conv.writeMessage(
            event.sender.name,
            event.getType() + ": " + JSON.stringify(event.getContent()),
            {
              system: true,
            }
          );
        } else {
          // This is an unhandled event type, for now just put it in the room as
          // the JSON body. This will need to be updated once (most) events are
          // handled.
          conv.writeMessage(
            event.sender.name,
            event.getType() + ": " + JSON.stringify(event.getContent()),
            {
              system: true,
            }
          );
        }
      }
    );
    // Update the chat participant information.
    this._client.on("RoomMember.name", this.updateRoomMember.bind(this));
    this._client.on("RoomMember.powerLevel", this.updateRoomMember.bind(this));

    // TODO Other events to handle:
    //  Room.localEchoUpdated
    //  Room.tags
    //  RoomMember.typing
    //  Session.logged_out
    //  User.avatarUrl
    //  User.currentlyActive
    //  User.displayName
    //  User.presence

    this._client.startClient();

    this._client.on("Room.name", room => {
      // Update the title to the human readable version.
      let conv = this.roomList.get(room.roomId);
      if (
        conv &&
        room.summary &&
        room.summary.info &&
        room.summary.info.title &&
        conv._name != room.summary.info.title
      ) {
        conv._name = room.summary.info.title;
        conv.notifyObservers(null, "update-conv-title");
      }
    });

    /*
     * We auto join all the rooms in which we are invited. This will also be
     * fired for all the rooms we have joined earlier when SDK gets connected.
     * We will use that part to to make conversations, direct or group.
     */
    this._client.on("Room", room => {
      let me = room.getMember(this.userId);
      // For now just auto accept the invites by joining the room.
      if (me && me.membership == "invite") {
        if (me.events.member.getContent().is_direct) {
          let roomMembers = room.getJoinedMembers();
          // If there is just single user in the room, then set the
          // room as a DM Room by adding it to dmMap in our user's accountData.
          if (roomMembers.length == 1) {
            let interlocutorId = roomMembers[0].userId;
            this.setDirectRoom(interlocutorId, room.roomId);
            // For the invited rooms, we will not get the summary info from
            // the room object created after the joining. So we need to use
            // the name from the room object here.
            this.getDirectConversation(
              interlocutorId,
              room.roomId,
              room.summary.info.title
            );
          } else {
            this.getGroupConversation(room.roomId, room.summary.info.title);
          }
        } else {
          this.getGroupConversation(room.roomId, room.summary.info.title);
        }
      } else if (me && me.membership == "join") {
        // To avoid the race condition. Whenever we will create the room,
        // this will also be fired. So we want to avoid making of multiple
        // conversations with the same room.
        if (!this.createRoomReturned || this.roomList.has(room.roomId)) {
          return;
        }
        if (this.isDirectRoom(room.roomId)) {
          let interlocutorId;
          for (let roomMember of room.getJoinedMembers()) {
            if (roomMember.userId != this.userId) {
              interlocutorId = roomMember.userId;
              break;
            }
          }
          this.getDirectConversation(interlocutorId);
        } else {
          this.getGroupConversation(room.roomId);
        }
      }
    });

    this._client.on("RoomMember.typing", (event, member) => {
      if (member.userId != this.userId) {
        let conv = this.roomList.get(member.roomId);
        if (!conv.isChat) {
          let typingState = Ci.prplIConvIM.NOT_TYPING;
          if (member.typing) {
            typingState = Ci.prplIConvIM.TYPING;
          }
          conv.updateTyping(typingState, member.name);
        }
      }
    });
  },

  /*
   * Checks if the room is the direct messaging room or not. We also check
   * if number of joined users are two including us.
   *
   * @param {String} checkRoomId - ID of the room to check if it is direct
   *                               messaging room or not.
   * @return {Boolean} - If room is direct direct messaging room or not.
   */
  isDirectRoom(checkRoomId) {
    for (let user of Object.keys(this._userToRoom)) {
      for (let roomId of this._userToRoom[user]) {
        if (roomId == checkRoomId) {
          let room = this._client.getRoom(roomId);
          if (room && room.getJoinedMembers().length == 2) {
            return true;
          }
        }
      }
    }
    return false;
  },

  /*
   * Converts the group conversation into the direct conversation.
   *
   * @param {Object} groupConv - the group conversation which needs to be
   *                             converted.
   */
  convertToDM(groupConv) {
    GenericConversationPrototype.close.call(groupConv);
    let conv = new MatrixDirectConversation(this, groupConv._roomId);
    this.roomList.set(groupConv._roomId, conv);
    let directRoom = this._client.getRoom(groupConv._roomId);
    conv.initRoom(directRoom);
  },

  /*
   * Converts the direct conversation into the group conversation.
   *
   * @param {Object} directConv - the direct conversation which needs to be
   *                              converted.
   */
  convertToGroup(directConv) {
    GenericConversationPrototype.close.call(directConv);
    let conv = new MatrixConversation(this, directConv._roomId, this.userId);
    this.roomList.set(directConv._roomId, conv);
    let groupRoom = this._client.getRoom(directConv._roomId);
    conv.initRoom(groupRoom);
  },

  /*
   * Checks if the conversation needs to be changed from the group conversation
   * to the direct conversation or vice versa.
   *
   * @param {Object} conv - the conversation which needs to be checked.
   */
  checkRoomForUpdate(conv) {
    if (conv.room && conv.isChat && this.isDirectRoom(conv._roomId)) {
      this.convertToDM(conv);
    } else if (conv.room && !conv.isChat && !this.isDirectRoom(conv._roomId)) {
      this.convertToGroup(conv);
    }
  },

  /*
   * Returns the group conversation according to the room-id.
   * 1) If we have a group conversation already, we will return that.
   * 2) If the room exists on the server, we will join it. It will not do
   *    anything if we are already joined, it will just create the
   *    conversation. This is used mainly when a new room gets added.
   * 3) Create a new room if the conversation does not exist.
   *
   * @param {String} roomId - ID of the room.
   * @param {String} roomName (optional) - Name of the room.
   *
   * @return {Object} - The resulted conversation.
   */
  getGroupConversation(roomId, roomName) {
    // If there is a conversation return it.
    if (this.roomList.has(roomId)) {
      return this.roomList.get(roomId);
    }

    if (roomId && this._client.getRoom(roomId)) {
      let conv = new MatrixConversation(this, roomName || roomId, this.userId);
      this.roomList.set(roomId, conv);
      conv.joining = true;
      this._client
        .joinRoom(roomId)
        .then(room => {
          conv.initRoom(room);
          conv.joining = false;
        })
        .catch(error => {
          this.ERROR(error);
          conv.joining = false;
          conv.close();
        })
        .done();

      return conv;
    }

    if (
      this.createRoomReturned &&
      roomId.endsWith(":" + this._client.getDomain())
    ) {
      this.createRoomReturned = false;
      let conv = new MatrixConversation(this, roomId, this.userId);
      conv.joining = true;
      let name = roomId.split(":", 1)[0];
      this._client
        .createRoom({
          room_alias_name: name,
          name,
          visibility: "private",
          preset: "private_chat",
          content: {
            guest_access: "can_join",
          },
          type: "m.room.guest_access",
          state_key: "",
        })
        .then(res => {
          this.createRoomReturned = true;
          let newRoomId = res.room_id;
          let room = this._client.getRoom(newRoomId);
          conv.initRoom(room);
          this.roomList.set(newRoomId, conv);
          conv.joining = false;
        })
        .catch(error => {
          this.createRoomReturned = true;
          this.ERROR(error);
          conv.joining = false;
          conv.close();
        })
        .done();
      return conv;
    }
    return null;
  },

  /*
   * Flag to avoid the race condition when we create any conversation.
   */
  createRoomReturned: true,

  /*
   * Returns the room ID for user ID if exists for direct messaging.
   *
   * @param {String} roomId - ID of the user.
   *
   * @return {String} - ID of the room.
   */
  getDMRoomIdForUserId(userId) {
    // Select the mostRecentRoom base on the timestamp of the
    // most recent event in the room's timeline.
    let mostRecentRoom = null;
    let mostRecentTimeStamp = 0;

    // Check in the 'other' user's roomList and add to our list.
    if (this._userToRoom[userId]) {
      for (let roomId of this._userToRoom[userId]) {
        let room = this._client.getRoom(roomId);
        if (room) {
          let user = room.getMember(userId);
          if (user) {
            let latestEvent = room.timeline[room.timeline.length - 1];
            // Timeline is null if our user's membership is invite.
            if (latestEvent) {
              let eventTimestamp = latestEvent.getTs();
              if (eventTimestamp > mostRecentTimeStamp) {
                mostRecentTimeStamp = eventTimestamp;
                mostRecentRoom = room;
              }
            }
          }
        }
      }
    }

    if (mostRecentRoom) {
      return mostRecentRoom.roomId;
    }
    return null;
  },

  /*
   * Sets the room ID for for corresponding user ID for direct messaging
   * by setting the "m.direct" event of accont data of the SDK client.
   *
   * @param {String} roomId - ID of the user.
   *
   * @param {String} - ID of the room.
   */
  setDirectRoom(userId, roomId) {
    let dmRoomMap = this._userToRoom;
    let roomList = dmRoomMap[userId] || [];
    if (!roomList.includes(roomId)) {
      roomList.push(roomId);
      dmRoomMap[userId] = roomList;
      this._client.setAccountData("m.direct", dmRoomMap);
    }
  },

  updateRoomMember(event, member) {
    if (this.roomList && this.roomList.has(member.roomId)) {
      let conv = this.roomList.get(member.roomId);
      if (conv.isChat) {
        let participant = conv._participants.get(member.userId);
        // A participant might not exist (for example, this happens if the user
        // has only been invited, but has not yet joined).
        if (participant) {
          participant._roomMember = member;
          conv.notifyObservers(participant, "chat-buddy-update");
          conv.notifyObservers(null, "chat-update-topic");
        }
      }
    }
  },

  disconnect() {
    this._client.stopClient();
    this.reportDisconnected();
  },

  get canJoinChat() {
    return true;
  },
  chatRoomFields: {
    // XXX Does it make sense to split up the server into a separate field?
    roomIdOrAlias: {
      get label() {
        return _("chatRoomField.room");
      },
      required: true,
    },
  },
  parseDefaultChatName(aDefaultName) {
    let chatFields = {
      roomIdOrAlias: aDefaultName,
    };

    return chatFields;
  },
  joinChat(components) {
    // For the format of room id and alias, see the matrix documentation:
    // https://matrix.org/docs/spec/appendices#room-ids-and-event-ids
    // https://matrix.org/docs/spec/appendices#room-aliases
    let roomIdOrAlias = components.getValue("roomIdOrAlias").trim();

    // If domain is missing, append the domain from the user's server.
    if (!roomIdOrAlias.includes(":")) {
      roomIdOrAlias += ":" + this._client.getDomain();
    }

    // There will be following types of ids:
    // !fubIsJzeAcCcjYTQvm:mozilla.org => General room id.
    // #maildev:mozilla.org => Group Conversation room id.
    // @clokep:mozilla.org => Direct Conversation room id.
    if (roomIdOrAlias.startsWith("!")) {
      // We create the group conversation initially. Then we check if the room
      // is the direct messaging room or not.
      let room = this._client.getRoom(roomIdOrAlias);
      if (!room) {
        return null;
      }
      let conv = new MatrixConversation(this, room.name, this.userId);
      conv.init(room);
      this.roomList.set(roomIdOrAlias, conv);
      // It can be any type of room so update it according to direct conversation
      // or group conversation.
      this.checkRoomForUpdate(conv);
      return conv;
    }

    // If the ID does not start with @ or #, assume it is a group conversation and append #.
    if (!roomIdOrAlias.startsWith("@") && !roomIdOrAlias.startsWith("#")) {
      roomIdOrAlias = "#" + roomIdOrAlias;
    }
    // If the ID starts with a @, it is a direct conversation.
    if (roomIdOrAlias.startsWith("@")) {
      return this.getDirectConversation(roomIdOrAlias);
    }
    // Otherwise, it is a group conversation.
    return this.getGroupConversation(roomIdOrAlias);
  },

  createConversation(userId) {
    if (userId == this.userId) {
      return null;
    }
    return this.getDirectConversation(userId);
  },

  /*
   * Returns the direct conversation according to the room-id or user-id.
   * 1) If we have a direct conversation already, we will return that.
   * 2) If the room exists on the server, we will join it. It will not do
   *    anything if we are already joined, it will just create the
   *    conversation. This is used mainly when a new room gets added.
   * 3) Create a new room if the conversation does not exist.
   *
   * @param {String} userId - ID of the user for which we want to get the
   *                          direct conversation.
   * @param {String} roomId (optional) - ID of the room.
   * @param {String} roomName (optional) - Name of the room.
   *
   * @return {Object} - The resulted conversation.
   */
  getDirectConversation(userId, roomID, roomName) {
    let DMRoomId = this.getDMRoomIdForUserId(userId);
    if (DMRoomId && this.roomList.has(DMRoomId)) {
      return this.roomList.get(DMRoomId);
    }

    // If user is invited to the room then DMRoomId will be null. In such
    // cases, we will pass roomID so that user will be joined to the room
    // and we will create corresponding conversation.
    if (DMRoomId || roomID) {
      let conv = new MatrixDirectConversation(
        this,
        roomName || DMRoomId || roomID
      );
      this.roomList.set(DMRoomId || roomID, conv);
      conv.joining = true;
      this._client
        .joinRoom(DMRoomId || roomID)
        .then(room => {
          conv.initRoom(room);
          conv.joining = false;
        })
        .catch(error => {
          this.ERROR(error);
          conv.joining = false;
          conv.close();
        })
        .done();

      return conv;
    }

    if (this.createRoomReturned) {
      this.createRoomReturned = false;
      let conv = new MatrixDirectConversation(this, userId);
      conv.joining = true;
      this._client
        .createRoom({
          is_direct: true,
          invite: [userId],
          visibility: "private",
          preset: "trusted_private_chat",
          content: {
            guest_access: "can_join",
          },
          type: "m.room.guest_access",
          state_key: "",
        })
        .then(res => {
          this.createRoomReturned = true;
          let newRoomId = res.room_id;
          let room = this._client.getRoom(newRoomId);
          conv.initRoom(room);
          this.setDirectRoom(userId, newRoomId);
          this.roomList.set(newRoomId, conv);
          conv.joining = false;
          this.checkRoomForUpdate(conv);
        })
        .catch(error => {
          this.createRoomReturned = true;
          this.ERROR(error);
          conv.joining = false;
          conv.close();
        })
        .done();

      return conv;
    }
    return null;
  },

  requestBuddyInfo(aUserId) {
    let user = this._client.getUser(aUserId);
    if (!user) {
      Services.obs.notifyObservers(
        EmptyEnumerator,
        "user-info-received",
        aUserId
      );
      return;
    }

    // Convert timespan in milli-seconds into a human-readable form.
    let getNormalizedTime = function(aTime) {
      let valuesAndUnits = DownloadUtils.convertTimeUnits(aTime / 1000);
      // If the time is exact to the first set of units, trim off
      // the subsequent zeroes.
      if (!valuesAndUnits[2]) {
        valuesAndUnits.splice(2, 2);
      }
      return _("tooltip.timespan", valuesAndUnits.join(" "));
    };

    let tooltipInfo = [];

    if (user.displayName) {
      tooltipInfo.push(
        new TooltipInfo(_("tooltip.displayName"), user.displayName)
      );
    }

    // Add the user's current status.
    const kSetIdleStatusAfterSeconds = 3600;
    const kPresentToStatusEnum = {
      online: Ci.imIStatusInfo.STATUS_AVAILABLE,
      offline: Ci.imIStatusInfo.STATUS_AWAY,
      unavailable: Ci.imIStatusInfo.STATUS_OFFLINE,
    };
    let status = kPresentToStatusEnum[user.presence];
    // If the user hasn't been seen in a long time, consider them idle.
    if (
      !user.currentlyActive &&
      user.lastActiveAgo > kSetIdleStatusAfterSeconds
    ) {
      status = Ci.imIStatusInfo.STATUS_IDLE;

      tooltipInfo.push(
        new TooltipInfo(
          _("tooltip.lastActive"),
          getNormalizedTime(user.lastActiveAgo)
        )
      );
    }
    tooltipInfo.push(
      new TooltipInfo(
        status,
        user.presenceStatusMsg,
        Ci.prplITooltipInfo.status
      )
    );

    if (user.avatarUrl) {
      // This matches the configuration of the .userIcon class in chat.css.
      const width = 48;
      const height = 48;

      // Convert the MXC URL to an HTTP URL.
      let realUrl = getHttpUriForMxc(
        this._client.getHomeserverUrl(),
        user.avatarUrl,
        width,
        height,
        "scale",
        false
      );
      // TODO Cache the photo URI for this participant.
      tooltipInfo.push(
        new TooltipInfo(null, realUrl, Ci.prplITooltipInfo.icon)
      );
    }

    Services.obs.notifyObservers(
      new nsSimpleEnumerator(tooltipInfo),
      "user-info-received",
      aUserId
    );
  },

  get userId() {
    return this._client.credentials.userId;
  },
  _client: null,
};

function MatrixProtocol() {}
MatrixProtocol.prototype = {
  __proto__: GenericProtocolPrototype,
  get normalizedName() {
    return "matrix";
  },
  get name() {
    return "Matrix";
  },
  get iconBaseURI() {
    return "chrome://prpl-matrix/skin/";
  },
  getAccount(aImAccount) {
    return new MatrixAccount(this, aImAccount);
  },

  options: {
    // XXX Default to matrix.org once we support connection as guest?
    server: {
      get label() {
        return _("options.connectServer");
      },
      default: "https://",
    },
    port: {
      get label() {
        return _("options.connectPort");
      },
      default: 443,
    },
  },

  get chatHasTopic() {
    return true;
  },
};
