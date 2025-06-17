import { Entity }       from "../entity";
import { Guild }        from "./guild";
import { Sizes }        from "./image";
import {
  CDN,
  fill_replacer,
  format_entity_with_sub,
  format_simple_entity,
  GENERIC_MESSAGES,
  KEYWORDS
}                       from "../../constants";
import { Method, Rest } from "../../core/rest";
import { log }          from "../../logger";
import {
  APIEmoji,
  APIGuild,
  CDNRoutes,
  EmojiFormat,
  ImageFormat,
  RESTPatchAPIGuildEmojiJSONBody
}                       from "discord-api-types/v10";

/**
 * Represents a custom emoji defined within a Discord guild.
 *
 * This class provides methods for managing the emoji entity, including
 * editing, deleting, fetching fresh state, and retrieving the image URL or
 * binary buffer.
 *
 * If the emoji is not associated with a guild (e.g., an application emoji),
 * only read-only access to its image is supported.
 *
 * @template Raw - The raw emoji payload type. Defaults to {@link APIEmoji}.
 */
export class Emoji<Raw extends APIEmoji = APIEmoji> extends Entity<Raw> {
  /**
   * The guild that owns this emoji, if available.
   *
   * Will be `null` for emojis managed at the application level.
   */
  public readonly guild: Guild | null;
  
  /**
   * Creates a new {@link Emoji} instance.
   *
   * @param rest - The REST client used for making API requests.
   * @param raw - The raw emoji payload returned by Discord's API.
   * @param guild_raw - The raw guild payload if this emoji is part of a guild.
   *   Used to associate the emoji with a {@link Guild} instance. Optional.
   */
  constructor(
    public readonly rest: Rest,
    public readonly raw: Raw,
    guild_raw?: APIGuild
  ) {
    let name: string;
    if ( guild_raw )
      name = format_entity_with_sub( new.target.name, guild_raw.id, raw.id as string );
    else
      name = format_simple_entity( new.target.name, raw.id as string );
    
    super( rest, raw, name );
    this.guild = guild_raw ? new Guild( rest, guild_raw ) : null;
  }
  
  /**
   * Generates a full CDN URL pointing to the image of this emoji.
   *
   * If the emoji is not a custom (uploaded) emoji, this method returns `null`.
   *
   * @param settings - Optional settings to control the image format and size.
   * @returns A full URL string or `null` if the emoji has no `id`.
   */
  public url(settings?: {
    format?: EmojiFormat;
    size?: Sizes;
  }): string | null {
    return this.raw.id
      ? `${ CDN }${ CDNRoutes.emoji( this.raw.id, settings?.format ?? ImageFormat.WebP ) }`
      : null;
  }
  
  /**
   * Fetches the raw image data of the emoji from Discord's CDN.
   *
   * This is useful for downloading or manipulating the emoji as binary data.
   *
   * @returns An `ArrayBuffer` containing the image data, or `null` if the
   *   emoji has no `id`.
   */
  public async buffer(): Promise<ArrayBuffer | null> {
    const URL = this.url();
    if ( !URL ) return null;
    
    const RESPONSE = await fetch( URL );
    return await RESPONSE.arrayBuffer();
  }
  
  /**
   * Fetches the most recent data for this emoji from the Discord API.
   *
   * This operation is only valid for emojis that are part of a guild.
   * Emojis without a guild (e.g., application-level emojis) cannot be
   * re-fetched.
   *
   * @returns A new {@link Emoji} instance with updated data.
   * @throws If the emoji is not part of a guild or if the request fails.
   */
  public async fetch(): Promise<Emoji> {
    if ( !this.guild )
      throw log.fail(
        this.format_name( "fetch" ),
        GENERIC_MESSAGES.NOT_PART.replace(
          ...fill_replacer( {
            [KEYWORDS.Id] : this.raw.id ?? "unknown",
            [KEYWORDS.Kind] : "emoji",
            [KEYWORDS.Part] : "guild. Manage it via the Application Class"
          } )
        )
      ).error();
    
    try {
      const API = await this.rest.request<APIEmoji>( {
        method : Method.GET,
        route : "guildEmoji",
        args : [ this.guild.raw.id, this.raw.id as string ]
      } );
      
      return new Emoji( this.rest, API, this.guild.raw );
    } catch ( err ) {
      throw log.fail( this.format_name( "fetch" ), String( err ) ).error();
    }
  }
  
  /**
   * Edits this emoji with the provided update payload.
   *
   * Only applicable to emojis that are part of a guild.
   *
   * @param body - A partial emoji update payload as defined by Discord's API.
   * @param reason - An optional reason for the audit log entry.
   * @returns A new {@link Emoji} instance with the updated data.
   * @throws If the emoji is not part of a guild or if the edit fails.
   */
  public async edit(body: RESTPatchAPIGuildEmojiJSONBody, reason?: string): Promise<Emoji> {
    if ( !this.guild )
      throw log.fail(
        this.format_name( "edit" ),
        GENERIC_MESSAGES.NOT_PART.replace(
          ...fill_replacer( {
            [KEYWORDS.Id] : this.raw.id ?? "unknown",
            [KEYWORDS.Kind] : "emoji",
            [KEYWORDS.Part] : "guild. Manage it via the Application Class"
          } )
        )
      ).error();
    
    try {
      const API = await this.rest.request<APIEmoji>( {
        method : Method.PATCH,
        route : "guildEmoji",
        args : [ this.guild.raw.id, this.raw.id as string ],
        reason,
        body
      } );
      
      return new Emoji( this.rest, API, this.guild.raw );
    } catch ( err ) {
      throw log.fail( this.format_name( "edit" ), String( err ) ).error();
    }
  }
  
  /**
   * Deletes this emoji from the guild.
   *
   * Only valid for emojis that belong to a guild.
   *
   * @param reason - An optional reason for the audit log entry.
   * @returns `true` if the emoji was deleted successfully; otherwise, throws
   *   an error.
   * @throws If the emoji is not part of a guild or if the request fails.
   */
  public async destroy(reason?: string): Promise<boolean> {
    if ( !this.guild )
      throw log.fail(
        this.format_name( "destroy" ),
        GENERIC_MESSAGES.NOT_PART.replace(
          ...fill_replacer( {
            [KEYWORDS.Id] : this.raw.id ?? "unknown",
            [KEYWORDS.Kind] : "emoji",
            [KEYWORDS.Part] : "guild. Manage it via the Application Class"
          } )
        )
      ).error();
    
    try {
      await this.rest.request( {
        method : Method.DELETE,
        route : "guildEmoji",
        args : [ this.guild.raw.id, this.raw.id as string ],
        reason
      } );
      
      return true;
    } catch ( err ) {
      throw log.fail( this.format_name( "destroy" ), String( err ) ).error();
    }
  }
}
