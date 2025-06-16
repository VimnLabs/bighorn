import { Entity }       from "@entity";
import { Sizes }        from "@src/classes/entities/image";
import {
  CDN,
  fill_replacer,
  format_simple_entity,
  GENERIC_MESSAGES,
  KEYWORDS
}                       from "@src/constants";
import { Method, Rest } from "@src/core/rest";
import { log }          from "@src/logger";
import {
  APISticker,
  CDNRoutes,
  ImageFormat,
  RESTPatchAPIGuildStickerJSONBody,
  StickerFormat
}                       from "discord-api-types/v10";

/**
 * Represents a guild sticker object.
 *
 * This class wraps around the `APISticker` type and provides helper methods
 * for accessing its CDN URL, binary content, and interacting with the Discord
 * REST API.
 *
 * @template Raw - The raw sticker payload type (defaults to `APISticker`).
 */
export class Sticker<Raw extends APISticker = APISticker> extends Entity<Raw> {
  /**
   * Creates a new instance of the `Sticker` entity.
   *
   * @param rest - The REST client used to interact with the Discord API.
   * @param raw - The raw `APISticker` object returned from Discord.
   */
  constructor(public readonly rest: Rest, public readonly raw: Raw) {
    super( rest, raw, format_simple_entity( new.target.name, raw.id ) );
  }
  
  /**
   * Generates the CDN URL for accessing the image file of this sticker.
   *
   * @param settings - Optional CDN format and image size parameters.
   * @returns A valid URL to the sticker image or `null` if the sticker has no
   *   ID.
   */
  public url(settings?: {
    format?: StickerFormat;
    size?: Sizes;
  }): string | null {
    return this.raw.id
      ? `${ CDN }${ CDNRoutes.sticker( this.raw.id, settings?.format ?? ImageFormat.PNG ) }`
      : null;
  }
  
  /**
   * Downloads the sticker image as an `ArrayBuffer`.
   *
   * This method performs a fetch to the generated CDN URL.
   *
   * @returns An `ArrayBuffer` of the image content or `null` if no URL is
   *   available.
   */
  public async buffer(): Promise<ArrayBuffer | null> {
    const URL = this.url();
    if ( !URL ) return null;
    
    const RESPONSE = await fetch( URL );
    return await RESPONSE.arrayBuffer();
  }
  
  /**
   * Fetches the latest version of this sticker from the Discord API.
   *
   * @returns A new `Sticker` instance containing the updated data.
   */
  public async fetch(): Promise<Sticker> {
    try {
      const API = await this.rest.request<APISticker>( {
        method : Method.GET,
        route : "sticker",
        args : [ this.raw.id ]
      } );
      return new Sticker( this.rest, API );
    } catch ( err ) {
      throw log.fail( this.format_name( "fetch" ), String( err ) ).error();
    }
  }
  
  /**
   * Edits the guild sticker's metadata.
   *
   * Discord only allows editing stickers that are part of a guild.
   * This method throws if `raw.guild_id` is not present.
   *
   * @param body - The fields to update in the sticker.
   * @param reason - Optional audit log reason.
   * @returns A new `Sticker` instance containing the updated data.
   */
  public async edit(body: RESTPatchAPIGuildStickerJSONBody, reason?: string): Promise<Sticker> {
    try {
      if ( !this.raw.guild_id ) {
        throw new Error( GENERIC_MESSAGES.NOT_PART.replace( ...fill_replacer( {
          [KEYWORDS.Id] : this.raw.id,
          [KEYWORDS.Kind] : "sticker",
          [KEYWORDS.Part] : "guild"
        } ) ) );
      }
      
      const API = await this.rest.request<APISticker>( {
        method : Method.PATCH,
        route : "guildSticker",
        args : [ this.raw.guild_id, this.raw.id ],
        reason,
        body
      } );
      
      return new Sticker( this.rest, API );
    } catch ( err ) {
      throw log.fail( this.format_name( "edit" ), String( err ) ).error();
    }
  }
  
  /**
   * Deletes this sticker from its guild.
   *
   * This method throws if the sticker is not associated with a guild.
   *
   * @param reason - Optional audit log reason.
   * @returns `true` if the sticker was successfully deleted; `false` otherwise.
   */
  public async destroy(reason?: string): Promise<boolean> {
    try {
      if ( !this.raw.guild_id ) {
        throw new Error( GENERIC_MESSAGES.NOT_PART.replace( ...fill_replacer( {
          [KEYWORDS.Id] : this.raw.id,
          [KEYWORDS.Kind] : "sticker",
          [KEYWORDS.Part] : "guild"
        } ) ) );
      }
      
      await this.rest.request( {
        method : Method.DELETE,
        route : "guildSticker",
        args : [ this.raw.guild_id, this.raw.id ],
        reason
      } );
      
      return true;
    } catch ( err ) {
      throw log.fail( this.format_name( "destroy" ), String( err ) ).error();
    }
  }
}
