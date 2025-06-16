import { Entity } from "@entity";
import {
  Channel
}                 from "@src/classes/entities/channel";
import {
  User
}                 from "@src/classes/entities/user";
import {
  fill_replacer,
  format_simple_entity,
  GENERIC_MESSAGES,
  KEYWORDS
}                 from "@src/constants";
import {
  Attachment,
  Method,
  Rest
}                 from "@src/core/rest";
import {
  log
}                 from "@src/logger";
import {
  APIChannel,
  APIMessage,
  APIPartialEmoji,
  APIReaction,
  APIUser,
  GatewayMessageCreateDispatchData,
  MessageType,
  RESTPatchAPIChannelMessageJSONBody,
  RESTPostAPIChannelMessageJSONBody
}                 from "discord-api-types/v10";
import {
  Snowflake
}                 from "discord-api-types/v6";

/**
 * Represents the raw message data returned from Discord,
 * either as a Gateway dispatch payload or a REST API response.
 */
export type RawMessage<Type extends MessageType> =
  | (GatewayMessageCreateDispatchData
  | APIMessage) & { type: Type };

/**
 * Strongly typed wrapper around Discord message objects, extending the base
 * `Entity`. Includes helpers for fetching message metadata, editing, replying,
 * reacting, and type guards.
 *
 * @template Type The specific `MessageType` this instance represents.
 * @template Raw The raw Discord API message payload, constrained by `Type`.
 */
export class Message<Type extends MessageType = MessageType, Raw extends RawMessage<Type> = RawMessage<Type>> extends Entity<Raw> {
  /** The author of this message as a `User` instance. */
  public readonly author: User;
  
  /**
   * Constructs a new message entity wrapper.
   * @param rest The REST client instance used to perform API calls.
   * @param raw The raw Discord API message payload.
   */
  constructor(public readonly rest: Rest, public readonly raw: Raw) {
    super( rest, raw, format_simple_entity( new.target.name, raw.id ) );
    this.author = new User( rest, raw.author );
  }
  
  /**
   * Refetches the message from Discord to ensure it’s up to date.
   * @returns A new `Message` instance with updated data.
   */
  public async fetch(): Promise<Message<Type, Raw>> {
    try {
      const API = await this.rest.request<APIMessage>( {
        method : Method.GET,
        route : "channelMessage",
        args : [ this.raw.channel_id, this.raw.id ]
      } );
      return new Message( this.rest, API as Raw );
    } catch ( err ) {
      throw log.fail( this.format_name( "fetch" ), String( err ) ).error();
    }
  }
  
  /**
   * Fetches the channel this message belongs to.
   * @returns A `Channel` instance representing the message's channel.
   */
  public async channel(): Promise<Channel> {
    try {
      const API = await this.rest.request<APIChannel>( {
        method : Method.GET,
        route : "channel",
        args : [ this.raw.channel_id ]
      } );
      return new Channel( this.rest, API );
    } catch ( err ) {
      throw log.fail( this.format_name( "channel" ), String( err ) ).error();
    }
  }
  
  /**
   * Replies to this message in the same channel.
   * @param data The message content and options to send.
   * @param force If true, allows replying to deleted messages.
   * @returns A `Message` instance of the reply.
   */
  public async reply(data: RESTPostAPIChannelMessageJSONBody, force = false): Promise<Message | this> {
    try {
      data.message_reference = {
        message_id : this.raw.id,
        channel_id : this.raw.channel_id,
        fail_if_not_exists : !force
      };
      const API = await this.rest.request<RawMessage<MessageType>>( {
        method : Method.POST,
        route : "channelMessages",
        args : [ this.raw.channel_id ],
        body : data
      } );
      return new Message( this.rest, API );
    } catch ( err ) {
      throw log.fail( this.format_name( "reply" ), String( err ) ).error();
    }
  }
  
  /**
   * Edits the content or embeds of this message.
   *
   * This operation is only permitted if the message was sent by the bot
   * itself.
   * If the author is different, a warning is logged and the current instance
   * is returned unchanged.
   *
   * @param data - The partial message data to update (content, embeds, etc.).
   * @param attachments - Optional array of attachments to include with the
   *   edit.
   * @returns A Promise that resolves to a new `Message` instance representing
   *   the updated message, or `this` if editing is disallowed or an error
   *   occurs.
   */
  public async edit(
    data: RESTPatchAPIChannelMessageJSONBody,
    attachments?: Attachment[]
  ): Promise<Message<Type, Raw> | this> {
    // Check if the message author matches the bot's user ID
    if ( this.author.raw.id !== (await this.rest.me()).raw.id ) {
      log.warn(
        this.format_name( "edit" ),
        GENERIC_MESSAGES.FROM_OTHERS.replace(
          ...fill_replacer( {
            [KEYWORDS.Action] : "edit messages",
            [KEYWORDS.Kind] : "users"
          } )
        )
      );
      return this;
    }
    
    try {
      const API = await this.rest.request<APIMessage>( {
        method : Method.PATCH,
        route : "channelMessage",
        args : [ this.raw.channel_id, this.raw.id ],
        body : data,
        attachments
      } );
      
      return new Message( this.rest, API as Raw );
    } catch ( err ) {
      throw log.fail( this.format_name( "edit" ), String( err ) ).error();
    }
  }
  
  /**
   * Deletes this message.
   * @param reason Optional reason for audit log.
   * @returns `true` if successful, `false` otherwise.
   */
  public async destroy(reason?: string): Promise<boolean> {
    try {
      await this.rest.request( {
        method : Method.DELETE,
        route : "channelMessage",
        args : [ this.raw.channel_id, this.raw.id ],
        reason
      } );
      return true;
    } catch ( err ) {
      throw log.fail( this.format_name( "destroy" ), String( err ) ).error();
    }
  }
  
  /**
   * Adds a reaction to this message.
   * @param emoji The emoji to react with, either partial emoji or a snowflake
   *   string.
   * @returns `true` if successful, `false` otherwise.
   */
  public async react(emoji: Omit<APIPartialEmoji, "animated"> | Snowflake): Promise<boolean> {
    let _emoji: string;
    if ( typeof emoji === "string" ) _emoji = encodeURIComponent( emoji );
    else _emoji = `${ emoji.name }:${ emoji.id }`;
    try {
      await this.rest.request( {
        method : Method.PUT,
        route : "channelMessageOwnReaction",
        args : [ this.raw.channel_id, this.raw.id, _emoji ]
      } );
      return true;
    } catch ( err ) {
      log.warn( this.format_name( "react" ), String( err ) );
      return false;
    }
  }
  
  /**
   * Removes a reaction from this message for a specific user.
   * @param emoji The emoji to remove, either partial emoji or a snowflake
   *   string.
   * @param ownerId The user ID or "@me" whose reaction should be removed;
   *   defaults to "@me".
   * @returns `true` if successful, `false` otherwise.
   */
  public async unreact(emoji: Omit<APIPartialEmoji, "animated"> | Snowflake, ownerId: Snowflake | "@me" = "@me"): Promise<boolean> {
    let _emoji: string;
    if ( typeof emoji === "string" ) _emoji = encodeURIComponent( emoji );
    else _emoji = `${ emoji.name }:${ emoji.id }`;
    try {
      await this.rest.request( {
        method : Method.PUT,
        route : "channelMessageUserReaction",
        args : [ this.raw.channel_id, this.raw.id, _emoji, ownerId ]
      } );
      return true;
    } catch ( err ) {
      log.warn( this.format_name( "unreact" ), String( err ) );
      return false;
    }
  }
  
  /**
   * Finds and returns the `APIReaction` for a given emoji name or ID.
   * @param reaction The name or ID of the emoji.
   * @returns The matched `APIReaction` object, or undefined if none found.
   */
  public reaction(reaction: string): APIReaction | undefined {
    return this.raw.reactions?.find(
      ({ emoji : { id, name } }) => id === reaction || name === reaction
    );
  }
  
  /**
   * Pins this message in the channel.
   * @param reason Optional reason for audit log.
   * @returns `true` if successful, `false` otherwise.
   */
  public async pin(reason?: string): Promise<boolean> {
    try {
      await this.rest.request( {
        method : Method.PUT,
        route : "channelPin",
        args : [ this.raw.channel_id, this.raw.id ],
        reason
      } );
      return true;
    } catch ( err ) {
      log.warn( this.format_name( "pin" ), String( err ) );
      return false;
    }
  }
  
  /**
   * Unpins this message from the channel.
   * @param reason Optional reason for audit log.
   * @returns `true` if successful, `false` otherwise.
   */
  public async unpin(reason?: string): Promise<boolean> {
    try {
      await this.rest.request( {
        method : Method.DELETE,
        route : "channelPin",
        args : [ this.raw.channel_id, this.raw.id ],
        reason
      } );
      return true;
    } catch ( err ) {
      log.warn( this.format_name( "unpin" ), String( err ) );
      return false;
    }
  }
  
  /**
   * Ends an active poll if the message is of type `Poll`.
   * @returns A `Message` instance of type `PollResult` or undefined if an
   *   error occurs.
   */
  public async endPoll(): Promise<Message<MessageType.PollResult> | undefined> {
    if ( this.author.raw.id !== (await this.rest.me()).raw.id ) {
      log.warn( this.format_name( "edit" ), GENERIC_MESSAGES.FROM_OTHERS.replace( ...fill_replacer( {
        [KEYWORDS.Action] : "end polls",
        [KEYWORDS.Kind] : "users"
      } ) ) );
      return undefined;
    }
    
    try {
      const API = await this.rest.request<RawMessage<MessageType.PollResult>>( {
        method : Method.POST,
        route : "expirePoll",
        args : [ this.raw.channel_id, this.raw.id ]
      } );
      return new Message<MessageType.PollResult>( this.rest, API );
    } catch ( err ) {
      log.warn( this.format_name( "endPoll" ), String( err ) );
      return undefined;
    }
  }
  
  /**
   * Fetches the list of users who selected a specific poll answer.
   * @param answerId The ID of the poll answer to retrieve voters for.
   * @returns An array of `User` instances who voted for the answer.
   */
  public async answerVoters(answerId: number): Promise<User[]> {
    try {
      const API = await this.rest.request<APIUser[]>( {
        method : Method.GET,
        route : "pollAnswerVoters",
        args : [ this.raw.channel_id, this.raw.id, answerId ]
      } );
      return API.map( user => new User( this.rest, user ) );
    } catch ( err ) {
      log.warn( this.format_name( "answerVoters" ), String( err ) );
      return [];
    }
  }
  
  // ----- TYPE GUARDS -----
  
  /** Type guard for `MessageType.Default` */
  public isDefault(): this is Message<MessageType.Default> {
    return this.raw.type === MessageType.Default;
  }
  
  /** Type guard for `MessageType.RecipientAdd` */
  public isRecipientAdd(): this is Message<MessageType.RecipientAdd> {
    return this.raw.type === MessageType.RecipientAdd;
  }
  
  /** Type guard for `MessageType.RecipientRemove` */
  public isRecipientRemove(): this is Message<MessageType.RecipientRemove> {
    return this.raw.type === MessageType.RecipientRemove;
  }
  
  /** Type guard for `MessageType.Call` */
  public isCall(): this is Message<MessageType.Call> {
    return this.raw.type === MessageType.Call;
  }
  
  /** Type guard for `MessageType.ChannelNameChange` */
  public isChannelNameChange(): this is Message<MessageType.ChannelNameChange> {
    return this.raw.type === MessageType.ChannelNameChange;
  }
  
  /** Type guard for `MessageType.ChannelIconChange` */
  public isChannelIconChange(): this is Message<MessageType.ChannelIconChange> {
    return this.raw.type === MessageType.ChannelIconChange;
  }
  
  /** Type guard for `MessageType.ChannelPinnedMessage` */
  public isChannelPinnedMessage(): this is Message<MessageType.ChannelPinnedMessage> {
    return this.raw.type === MessageType.ChannelPinnedMessage;
  }
  
  /** Type guard for `MessageType.UserJoin` */
  public isUserJoin(): this is Message<MessageType.UserJoin> {
    return this.raw.type === MessageType.UserJoin;
  }
  
  /** Type guard for `MessageType.GuildBoost` */
  public isGuildBoost(): this is Message<MessageType.GuildBoost> {
    return this.raw.type === MessageType.GuildBoost;
  }
  
  /** Type guard for `MessageType.GuildBoostTier1` */
  public isGuildBoostTier1(): this is Message<MessageType.GuildBoostTier1> {
    return this.raw.type === MessageType.GuildBoostTier1;
  }
  
  /** Type guard for `MessageType.GuildBoostTier2` */
  public isGuildBoostTier2(): this is Message<MessageType.GuildBoostTier2> {
    return this.raw.type === MessageType.GuildBoostTier2;
  }
  
  /** Type guard for `MessageType.GuildBoostTier3` */
  public isGuildBoostTier3(): this is Message<MessageType.GuildBoostTier3> {
    return this.raw.type === MessageType.GuildBoostTier3;
  }
  
  /** Type guard for `MessageType.ChannelFollowAdd` */
  public isChannelFollowAdd(): this is Message<MessageType.ChannelFollowAdd> {
    return this.raw.type === MessageType.ChannelFollowAdd;
  }
  
  /** Type guard for `MessageType.ThreadCreated` */
  public isThreadCreated(): this is Message<MessageType.ThreadCreated> {
    return this.raw.type === MessageType.ThreadCreated;
  }
  
  /** Type guard for `MessageType.Reply` */
  public isReply(): this is Message<MessageType.Reply> {
    return this.raw.type === MessageType.Reply;
  }
  
  /** Type guard for `MessageType.ThreadStarterMessage` */
  public isThreadStarterMessage(): this is Message<MessageType.ThreadStarterMessage> {
    return this.raw.type === MessageType.ThreadStarterMessage;
  }
  
  /** Type guard for `MessageType.ContextMenuCommand` */
  public isContextMenuCommand(): this is Message<MessageType.ContextMenuCommand> {
    return this.raw.type === MessageType.ContextMenuCommand;
  }
  
  /** Type guard for `MessageType.AutoModerationAction` */
  public isAutoModerationAction(): this is Message<MessageType.AutoModerationAction> {
    return this.raw.type === MessageType.AutoModerationAction;
  }
  
  /** Type guard for `MessageType.RoleSubscriptionPurchase` */
  public isRoleSubscriptionPurchase(): this is Message<MessageType.RoleSubscriptionPurchase> {
    return this.raw.type === MessageType.RoleSubscriptionPurchase;
  }
  
  /** Type guard for `MessageType.InteractionPremiumUpsell` */
  public isInteractionPremiumUpsell(): this is Message<MessageType.InteractionPremiumUpsell> {
    return this.raw.type === MessageType.InteractionPremiumUpsell;
  }
  
  /** Type guard for `MessageType.StageStart` */
  public isStageStart(): this is Message<MessageType.StageStart> {
    return this.raw.type === MessageType.StageStart;
  }
  
  /** Type guard for `MessageType.StageEnd` */
  public isStageEnd(): this is Message<MessageType.StageEnd> {
    return this.raw.type === MessageType.StageEnd;
  }
  
  /** Type guard for `MessageType.StageSpeaker` */
  public isStageSpeaker(): this is Message<MessageType.StageSpeaker> {
    return this.raw.type === MessageType.StageSpeaker;
  }
  
  /** Type guard for `MessageType.StageRaiseHand` */
  public isStageRaiseHand(): this is Message<MessageType.StageRaiseHand> {
    return this.raw.type === MessageType.StageRaiseHand;
  }
  
  /** Type guard for `MessageType.StageTopic` */
  public isStageTopic(): this is Message<MessageType.StageTopic> {
    return this.raw.type === MessageType.StageTopic;
  }
  
  /** Type guard for `MessageType.GuildApplicationPremiumSubscription` */
  public isGuildApplicationPremiumSubscription(): this is Message<MessageType.GuildApplicationPremiumSubscription> {
    return this.raw.type === MessageType.GuildApplicationPremiumSubscription;
  }
  
  /** Type guard for `MessageType.GuildInviteReminder` */
  public isGuildInviteReminder(): this is Message<MessageType.GuildInviteReminder> {
    return this.raw.type === MessageType.GuildInviteReminder;
  }
  
  /** Type guard for `MessageType.PollResult` */
  public isPollResult(): this is Message<MessageType.PollResult> {
    return this.raw.type === MessageType.PollResult;
  }
}
