import { Entity }                 from "@entity";
import { Emoji }                  from "@src/classes/entities/emoji";
import { GuildBanner, GuildIcon } from "@src/classes/entities/image";
import { Role }                   from "@src/classes/entities/role";
import { format_simple_entity }   from "@src/constants";
import { Method, Rest }           from "@src/core/rest";
import { Dictionary }             from "@src/dictionary";
import { log }                    from "@src/logger";
import {
  APIBan,
  APIChannel,
  APIEmoji,
  APIGuild,
  APIGuildChannel,
  APIGuildMember,
  APIGuildPreview,
  APIThreadChannel,
  APIThreadList,
  ChannelType,
  RESTPostAPIGuildChannelJSONBody,
  Snowflake
}                                 from "discord-api-types/v10";
import { Channel }                from "./channel";
import { Member }                 from "./member";

/**
 * Represents a Discord Guild (server), offering methods to interact with
 * channels, members, roles, bans, icons, and other guild-level operations.
 *
 * @template Raw The raw payload structure of the guild, defaults to `APIGuild`.
 * @extends Entity<Raw>
 */
export class Guild<Raw extends APIGuild = APIGuild> extends Entity<Raw> {
  /**
   * Constructs a new Guild instance.
   *
   * @param rest - The REST client used to perform API operations.
   * @param raw - The raw payload representing the guild from Discord's API.
   */
  constructor(public readonly rest: Rest, public readonly raw: Raw) {
    super( rest, raw, format_simple_entity( new.target.name, raw.id ) );
  }
  
  /**
   * Provides channel-related operations for this guild.
   */
  get channel() {
    return {
      /**
       * Fetches all channels in this guild.
       *
       * @returns A dictionary mapping channel IDs to `Channel` instances.
       */
      list : async (): Promise<Dictionary<string, Channel>> => {
        try {
          const API = await this.rest.request<APIGuildChannel<ChannelType>[]>( {
            method : Method.GET,
            route : "guildChannels",
            args : [ this.raw.id ]
          } );
          return new Dictionary(
            API.map( ch => [ ch.id, new Channel<APIChannel>( this.rest, ch as APIChannel ) ] )
          );
        } catch ( err ) {
          throw log.fail( this.format_name( "channel.list" ), String( err ) ).error();
        }
      },
      
      /**
       * Creates a new channel in this guild.
       *
       * @param data - The channel creation payload.
       * @returns The created `Channel` instance.
       */
      create : async (data: RESTPostAPIGuildChannelJSONBody): Promise<Channel> => {
        try {
          const API = await this.rest.request<APIChannel>( {
            method : Method.POST,
            route : "guildChannels",
            args : [ this.raw.id ],
            body : data
          } );
          return new Channel( this.rest, API );
        } catch ( err ) {
          throw log.fail( this.format_name( "channel.create" ), String( err ) ).error();
        }
      }
    };
  }
  
  /**
   * Fetches the most recent data for this guild.
   *
   * @returns A new `Guild` instance with updated data.
   */
  public async fetch(): Promise<Guild> {
    try {
      const API = await this.rest.request<APIGuild>( {
        method : Method.GET,
        route : "guild",
        args : [ this.raw.id ]
      } );
      return new Guild( this.rest, API );
    } catch ( err ) {
      throw log.fail( this.format_name( "fetch" ), String( err ) ).error();
    }
  }
  
  /**
   * Edits this guild with the provided data.
   *
   * @param data - Partial guild update payload.
   * @param reason - Optional audit log reason.
   * @returns A new `Guild` instance with the applied changes.
   */
  public async edit(data: Partial<APIGuild>, reason?: string): Promise<Guild> {
    try {
      const API = await this.rest.request<APIGuild>( {
        method : Method.PATCH,
        route : "guild",
        args : [ this.raw.id ],
        body : data,
        reason
      } );
      return new Guild( this.rest, API );
    } catch ( err ) {
      throw log.fail( this.format_name( "edit" ), String( err ) ).error();
    }
  }
  
  /**
   * Returns a `GuildIcon` wrapper for this guild's icon.
   */
  public icon(): GuildIcon {
    return new GuildIcon( this.rest, {
      hash : this.raw.icon ?? null,
      ownerId : this.raw.id
    } );
  }
  
  /**
   * Returns a `GuildBanner` wrapper for this guild's banner.
   */
  public banner(): GuildBanner {
    return new GuildBanner( this.rest, {
      hash : this.raw.banner ?? null,
      ownerId : this.raw.id
    } );
  }
  
  /**
   * Fetches the public preview data of this guild.
   *
   * @returns The `APIGuildPreview` payload.
   */
  public async preview(): Promise<APIGuildPreview> {
    try {
      return await this.rest.request<APIGuildPreview>( {
        method : Method.GET,
        route : "guildPreview",
        args : [ this.raw.id ]
      } );
    } catch ( err ) {
      throw log.fail( this.format_name( "preview" ), String( err ) ).error();
    }
  }
  
  /**
   * Fetches all active threads in the guild.
   *
   * @returns A dictionary of thread channels.
   */
  public async threads(): Promise<Dictionary<string, Channel<APIThreadChannel>>> {
    try {
      const API = await this.rest.request<APIThreadList>( {
        method : Method.GET,
        route : "guildActiveThreads",
        args : [ this.raw.id ]
      } );
      return new Dictionary(
        API.threads.map( ch => [ ch.id, new Channel<APIThreadChannel>( this.rest, ch as APIThreadChannel ) ] )
      );
    } catch ( err ) {
      throw log.fail( this.format_name( "threads" ), String( err ) ).error();
    }
  }
  
  /**
   * Fetches all guild members.
   *
   * @returns A dictionary mapping user IDs to `Member` instances.
   */
  public async members(): Promise<Dictionary<Snowflake, Member>> {
    try {
      const API = await this.rest.request<APIGuildMember[]>( {
        method : Method.GET,
        route : "guildMembers",
        args : [ this.raw.id ]
      } );
      return new Dictionary( API.map( m => [ m.user.id, new Member( this.rest, m, this.raw ) ] ) );
    } catch ( err ) {
      throw log.fail( this.format_name( "members" ), String( err ) ).error();
    }
  }
  
  /**
   * Fetches a specific member from the guild by user ID.
   *
   * @param id - The user ID.
   * @returns A `Member` instance or null if not found.
   */
  public async member(id: Snowflake): Promise<Member | null> {
    try {
      const API = await this.rest.request<APIGuildMember>( {
        method : Method.GET,
        route : "guildMember",
        args : [ this.raw.id, id ]
      } );
      return new Member( this.rest, API, this.raw );
    } catch ( err ) {
      log.warn( this.format_name( "member" ), String( err ) );
      return null;
    }
  }
  
  /**
   * Fetches all custom emojis available in the current guild.
   *
   * This method calls the `GET /guilds/:guild_id/emojis` endpoint and returns
   * a dictionary mapping each emoji's ID to an {@link Emoji} instance.
   *
   * @returns A {@link Dictionary} of {@link Emoji} instances, keyed by their
   *   {@link Snowflake} ID.
   * @throws If the request fails, a structured error with logging is thrown.
   */
  public async emojis(): Promise<Dictionary<Snowflake, Emoji>> {
    try {
      const API = await this.rest.request<APIEmoji[]>( {
        method : Method.GET,
        route : "guildEmojis",
        args : [ this.raw.id ]
      } );
      
      return new Dictionary(
        API.map( e => [ e.id!, new Emoji( this.rest, e, this.raw ) ] )
      );
    } catch ( err ) {
      throw log.fail( this.format_name( "emojis" ), String( err ) ).error();
    }
  }
  
  
  /**
   * Fetches a single custom emoji by its ID from the current guild.
   *
   * This method uses the `GET /guilds/:guild_id/emojis/:emoji_id` endpoint to
   * retrieve a specific emoji and construct an {@link Emoji} instance.
   *
   * @param id - The {@link Snowflake} ID of the emoji to retrieve.
   * @returns An {@link Emoji} instance, or `null` if the emoji could not be
   *   fetched.
   * @throws Only logs a warning internally if the request fails; returns
   *   `null` on failure.
   */
  public async emoji(id: Snowflake): Promise<Emoji | null> {
    try {
      const API = await this.rest.request<APIEmoji>( {
        method : Method.GET,
        route : "guildEmoji",
        args : [ this.raw.id, id ]
      } );
      
      return new Emoji( this.rest, API, this.raw );
    } catch ( err ) {
      log.warn( this.format_name( "emoji" ), String( err ) );
      return null;
    }
  }
  
  
  /**
   * Removes a member from the guild.
   *
   * @param id - The user ID.
   * @param reason - Optional audit log reason.
   * @returns True if the operation succeeded.
   */
  public async kick(id: Snowflake, reason?: string): Promise<boolean> {
    try {
      await this.rest.request<APIGuildMember>( {
        method : Method.DELETE,
        route : "guildMember",
        args : [ this.raw.id, id ],
        reason
      } );
      return true;
    } catch ( err ) {
      log.warn( this.format_name( "kick" ), String( err ) );
      return false;
    }
  }
  
  /**
   * Bans a member from the guild.
   *
   * @param id - The user ID.
   * @param seconds - Optional message history deletion in seconds.
   * @param reason - Optional audit log reason.
   * @returns True if the operation succeeded.
   */
  public async ban(id: Snowflake, seconds?: number, reason?: string): Promise<boolean> {
    try {
      await this.rest.request<APIGuildMember>( {
        method : Method.PUT,
        route : "guildBan",
        args : [ this.raw.id, id ],
        reason,
        body : {
          delete_message_seconds : seconds
        }
      } );
      return true;
    } catch ( err ) {
      log.warn( this.format_name( "ban" ), String( err ) );
      return false;
    }
  }
  
  /**
   * Bans multiple users at once.
   *
   * @param ids - The user IDs to ban.
   * @param seconds - Optional message history deletion in seconds.
   * @param reason - Optional audit log reason.
   * @returns True if the operation succeeded.
   */
  public async bulkBan(ids: Snowflake[], seconds?: number, reason?: string): Promise<boolean> {
    try {
      await this.rest.request( {
        method : Method.PUT,
        route : "guildBulkBan",
        args : [ this.raw.id ],
        body : {
          delete_message_seconds : seconds,
          user_ids : ids
        },
        reason
      } );
      return true;
    } catch ( err ) {
      log.warn( this.format_name( "bulkBan" ), String( err ) );
      return false;
    }
  }
  
  /**
   * Removes a user from the guild's ban list.
   *
   * @param id - The user ID.
   * @param reason - Optional audit log reason.
   * @returns True if the operation succeeded.
   */
  public async unban(id: Snowflake, reason?: string): Promise<boolean> {
    try {
      await this.rest.request<APIGuildMember>( {
        method : Method.DELETE,
        route : "guildBan",
        args : [ this.raw.id, id ],
        reason
      } );
      return true;
    } catch ( err ) {
      log.warn( this.format_name( "unban" ), String( err ) );
      return false;
    }
  }
  
  /**
   * Retrieves all bans in the guild.
   *
   * @param limit - Optional limit of bans to retrieve.
   * @param before - Ban entries before this user ID.
   * @param after - Ban entries after this user ID.
   * @returns An array of `APIBan` entries.
   */
  public async bans(
    limit?: number,
    before?: Snowflake | null,
    after?: Snowflake | null
  ): Promise<APIBan[]> {
    try {
      return await this.rest.request<APIBan[]>( {
        method : Method.GET,
        route : "guildBans",
        args : [ this.raw.id ],
        body : {
          limit,
          before,
          after
        }
      } );
    } catch ( err ) {
      throw log.fail( this.format_name( "bans" ), String( err ) ).error();
    }
  }
  
  /**
   * Retrieves a specific ban by user ID.
   *
   * @param id - The user ID.
   * @returns The `APIBan` entry if found, otherwise undefined.
   */
  public async getBan(id: Snowflake): Promise<APIBan> {
    try {
      return await this.rest.request<APIBan>( {
        method : Method.GET,
        route : "guildBan",
        args : [ this.raw.id, id ]
      } );
    } catch ( err ) {
      throw log.fail( this.format_name( "getBan" ), String( err ) ).error();
    }
  }
  
  /**
   * Converts raw role data into `Role` instances.
   *
   * @returns A dictionary mapping role IDs to `Role` objects.
   */
  public roles(): Dictionary<string, Role> {
    return new Dictionary<string, Role>(
      this.raw.roles.map( (r) => [ r.id, new Role( this.rest, r, this.raw ) ] )
    );
  }
  
  /**
   * Fetches the current bot/member instance from the guild where this
   * interaction occurred.
   *
   * This uses the `GET /guilds/:id/members/@me` endpoint, which retrieves the
   * bot's member data within the target guild. Useful for accessing
   * permissions, roles, or presence for the bot itself.
   *
   * @returns A {@link Member} instance representing the bot in the guild.
   * @throws If the request fails, a structured error with logging is thrown.
   */
  public async me(): Promise<Member> {
    try {
      const API = await this.rest.request<APIGuildMember>( {
        method : Method.GET,
        route : "guildMember",
        args : [ this.raw.id, "@me" ]
      } );
      return new Member( this.rest, API, this.raw );
    } catch ( err ) {
      throw log.fail( this.format_name( "member" ), String( err ) ).error();
    }
  }
}
