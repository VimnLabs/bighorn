import { Entity }                   from "../entity";
import { Message }                  from "./message";
import { format_simple_entity }     from "../../constants";
import { Attachment, Method, Rest } from "../../core/rest";
import { log }                      from "../../logger";
import {
  APIChannel,
  APIMessage,
  ChannelType,
  RESTPatchAPIChannelJSONBody,
  RESTPostAPIChannelMessageJSONBody,
  Snowflake
}                                   from "discord-api-types/v10";

/**
 * Represents a Discord Channel entity.
 *
 * Wraps a raw `APIChannel` structure and provides methods for interacting
 * with messages, updating the channel, and identifying channel types.
 *
 * @template Raw - Optional override for the raw channel type.
 */
export class Channel<Raw extends APIChannel = APIChannel> extends Entity<Raw> {
  /**
   * Creates a new Channel instance.
   *
   * @param rest - The REST client used for API interactions.
   * @param raw - The raw `APIChannel` object.
   */
  constructor(public readonly rest: Rest, public readonly raw: Raw) {
    super( rest, raw, format_simple_entity( new.target.name, raw.id ) );
  }
  
  /**
   * Message-related operations scoped to this channel.
   */
  get messages() {
    return {
      /**
       * Fetches a message by its ID.
       *
       * @param id - The ID of the message to retrieve.
       * @returns A `Message` instance, or throws on error.
       */
      fetch : async (id: Snowflake) => {
        try {
          const API = await this.rest.request<APIMessage>( {
            method : Method.GET,
            route : "channelMessage",
            args : [ this.raw.id, id ]
          } );
          return new Message( this.rest, API );
        } catch ( err ) {
          throw log.fail( this.format_name( "messages.fetch" ), String( err ) ).error();
        }
      },
      
      /**
       * Sends a new message to this channel.
       *
       * @param body - The content and metadata of the message.
       * @param attachments - Optional array of file attachments.
       * @returns A new `Message` instance representing the sent message.
       */
      send : async (body: RESTPostAPIChannelMessageJSONBody, attachments?: Attachment[]) => {
        try {
          const API = await this.rest.request<APIMessage>( {
            method : Method.POST,
            route : "channelMessages",
            args : [ this.raw.id ],
            body,
            attachments
          } );
          return new Message( this.rest, API );
        } catch ( err ) {
          throw log.fail( this.format_name( "messages.send" ), String( err ) ).error();
        }
      },
      
      /**
       * Bulk-deletes multiple messages by their IDs.
       *
       * @param ids - Array of message IDs to delete.
       * @param reason - Optional reason for audit logs.
       * @returns `true` if the deletion was successful, `false` otherwise.
       */
      bulkDelete : async (ids: Snowflake[], reason?: string) => {
        try {
          await this.rest.request( {
            method : Method.POST,
            route : "channelBulkDelete",
            args : [ this.raw.id ],
            body : { messages : ids },
            reason
          } );
          return true;
        } catch ( err ) {
          log.warn( this.format_name( "messages.bulkDelete" ), String( err ) );
          return false;
        }
      }
    };
  }
  
  /**
   * Fetches the latest state of this channel from the API.
   *
   * @returns An updated `Channel` instance.
   */
  public async fetch(): Promise<Channel> {
    try {
      const API = await this.rest.request<APIChannel>( {
        method : Method.GET,
        route : "channel",
        args : [ this.raw.id ]
      } );
      
      return new Channel( this.rest, API );
    } catch ( err ) {
      throw log.fail( this.format_name( "fetch" ), String( err ) ).error();
    }
  }
  
  /**
   * Edits the channel settings.
   *
   * @param body - Partial update payload.
   * @param reason - Optional reason for audit logs.
   * @returns A new `Channel` instance with updated properties.
   */
  public async edit(body: RESTPatchAPIChannelJSONBody, reason?: string): Promise<Channel> {
    try {
      const API = await this.rest.request<APIChannel>( {
        method : Method.PATCH,
        route : "channel",
        args : [ this.raw.id ],
        body,
        reason
      } );
      
      return new Channel( this.rest, API );
    } catch ( err ) {
      throw log.fail( this.format_name( "edit" ), String( err ) ).error();
    }
  }
  
  /**
   * Deletes this channel from the server.
   *
   * @param reason - Optional reason for audit logs.
   * @returns `true` if the channel was deleted, `false` otherwise.
   */
  public async destroy(reason?: string): Promise<boolean> {
    try {
      await this.rest.request( {
        method : Method.DELETE,
        route : "channel",
        args : [ this.raw.id ],
        reason
      } );
      return true;
    } catch ( err ) {
      throw log.fail( this.format_name( "destroy" ), String( err ) ).error();
    }
  }
  
  // ─────────────────────────────────────────────────────────────
  // Type guards
  // ─────────────────────────────────────────────────────────────
  
  /** Returns true if this channel is a guild text channel. */
  public isGuildText(): this is Channel<APIChannel & {
    type: ChannelType.GuildText
  }> {
    return this.raw.type === ChannelType.GuildText;
  }
  
  /** Returns true if this channel is a direct message (DM). */
  public isDM(): this is Channel<APIChannel & { type: ChannelType.DM }> {
    return this.raw.type === ChannelType.DM;
  }
  
  /** Returns true if this channel is a guild voice channel. */
  public isGuildVoice(): this is Channel<APIChannel & {
    type: ChannelType.GuildVoice
  }> {
    return this.raw.type === ChannelType.GuildVoice;
  }
  
  /** Returns true if this channel is a group direct message. */
  public isGroupDM(): this is Channel<APIChannel & {
    type: ChannelType.GroupDM
  }> {
    return this.raw.type === ChannelType.GroupDM;
  }
  
  /** Returns true if this channel is a guild category. */
  public isGuildCategory(): this is Channel<APIChannel & {
    type: ChannelType.GuildCategory
  }> {
    return this.raw.type === ChannelType.GuildCategory;
  }
  
  /** Returns true if this channel is a guild announcement channel. */
  public isGuildAnnouncement(): this is Channel<APIChannel & {
    type: ChannelType.GuildAnnouncement
  }> {
    return this.raw.type === ChannelType.GuildAnnouncement;
  }
  
  /** Returns true if this channel is an announcement thread. */
  public isAnnouncementThread(): this is Channel<APIChannel & {
    type: ChannelType.AnnouncementThread
  }> {
    return this.raw.type === ChannelType.AnnouncementThread;
  }
  
  /** Returns true if this channel is a public thread. */
  public isPublicThread(): this is Channel<APIChannel & {
    type: ChannelType.PublicThread
  }> {
    return this.raw.type === ChannelType.PublicThread;
  }
  
  /** Returns true if this channel is a private thread. */
  public isPrivateThread(): this is Channel<APIChannel & {
    type: ChannelType.PrivateThread
  }> {
    return this.raw.type === ChannelType.PrivateThread;
  }
  
  /** Returns true if this channel is a stage voice channel. */
  public isGuildStageVoice(): this is Channel<APIChannel & {
    type: ChannelType.GuildStageVoice
  }> {
    return this.raw.type === ChannelType.GuildStageVoice;
  }
  
  /** Returns true if this channel is a guild forum. */
  public isGuildForum(): this is Channel<APIChannel & {
    type: ChannelType.GuildForum
  }> {
    return this.raw.type === ChannelType.GuildForum;
  }
  
  /** Returns true if this channel is a guild media channel. */
  public isGuildMedia(): this is Channel<APIChannel & {
    type: ChannelType.GuildMedia
  }> {
    return this.raw.type === ChannelType.GuildMedia;
  }
  
  /**
   * Returns true if this channel is any kind of thread (announcement, public,
   * or private).
   */
  public isThread():
    this is Channel<APIChannel & {
      type: ChannelType.AnnouncementThread | ChannelType.PublicThread | ChannelType.PrivateThread
    }> {
    return this.isAnnouncementThread() || this.isPublicThread() || this.isPrivateThread();
  }
}
