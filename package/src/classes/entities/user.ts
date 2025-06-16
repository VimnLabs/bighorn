import { Entity }                 from "@entity";
import { UserAvatar, UserBanner } from "@src/classes/entities/image";
import {
  ENTITY_MESSAGES,
  EPOCH,
  fill_replacer,
  format_simple_entity,
  KEYWORDS
}                                 from "@src/constants";
import { Method, Rest }           from "@src/core/rest";
import { log }                    from "@src/logger";
import { APIUser }                from "discord-api-types/v10";

/**
 * Represents a Discord user entity.
 *
 * This class extends the generic `Entity` base with data from the Discord
 * API's `APIUser` object, and exposes convenience methods to compute creation
 * time, access user avatars and banners, and manage internal entity metadata.
 *
 * @template Raw - A type extending `APIUser`, allowing flexibility if the raw
 *   structure is extended.
 */
export class User<Raw extends APIUser = APIUser> extends Entity<Raw> {
  /**
   * Creates a new `User` entity instance.
   *
   * @param rest - The REST client used to make requests to the Discord API.
   * @param raw - The raw user payload (`APIUser`) from the Discord API.
   */
  constructor(public readonly rest: Rest, public readonly raw: Raw) {
    super( rest, raw, format_simple_entity( new.target.name, raw.id ) );
  }
  
  /**
   * Computes the timestamp of when the user account was created using the
   * Discord Snowflake format.
   *
   * This calculation extracts the timestamp encoded in the Snowflake and adds
   * the Discord epoch base time to derive a `Date` object.
   *
   * @returns A `Date` representing the time the user account was created.
   */
  public get created(): Date {
    const TIMESTAMP = BigInt( this.raw.id ) >> 22n;
    return new Date( Number( TIMESTAMP + EPOCH ) );
  }
  
  /**
   * Fetches the latest data for this user from the Discord API.
   *
   * This method performs a GET request to retrieve updated user data and
   * returns a new instance of the `User` class with the fresh information.
   *
   * If the request fails, an error will be logged and thrown using the
   * logger's `.fail().throw()` chain.
   *
   * @returns A `Promise` resolving to a fresh `User` instance with updated
   *   data.
   *
   * @throws {Error} If the request to the Discord API fails.
   */
  override async fetch(): Promise<User> {
    try {
      const updated = await this.rest.request<APIUser>( {
        method : Method.GET,
        route : "user",
        args : [ this.raw.id ]
      } );
      return new User( this.rest, updated );
    } catch ( err ) {
      throw log.fail( this.format_name( "fetch" ), String( err ) ).error();
    }
  }
  
  /**
   * Constructs a `UserAvatar` instance representing the user's profile avatar.
   *
   * This method creates a new `UserAvatar` object that encapsulates the
   * avatar hash and owner ID. If the user has no avatar (i.e., `avatar ===
   * null`), a warning is logged with a standardized message.
   *
   * @returns A `UserAvatar` object for the user. If `avatar` is `null`,
   *          the object will contain a `null` hash, and a warning will be
   *   emitted.
   */
  public avatar(): UserAvatar {
    if ( this.raw.avatar === null ) {
      log.warn( this.name, ENTITY_MESSAGES.NO_HASH.replace( ...fill_replacer( {
        [KEYWORDS.Kind] : "avatar"
      } ) ) );
    }
    
    return new UserAvatar( this.rest, {
      ownerId : this.raw.id,
      hash : this.raw.avatar
    } );
  }
  
  /**
   * Constructs a `UserBanner` instance representing the user's profile banner.
   *
   * This method creates a new `UserBanner` object that encapsulates the
   * banner hash and owner ID. If the user has no banner (i.e., `banner ===
   * null`), a warning is logged with a standardized message.
   *
   * @returns A `UserBanner` object for the user. If `banner` is `null`,
   *          the object will contain a `null` hash, and a warning will be
   *   emitted.
   */
  public banner(): UserBanner {
    if ( this.raw.banner === null ) {
      log.warn( this.name, ENTITY_MESSAGES.NO_HASH.replace( ...fill_replacer( {
        [KEYWORDS.Kind] : "banner"
      } ) ) );
    }
    
    return new UserBanner( this.rest, {
      ownerId : this.raw.id,
      hash : this.raw.banner ?? null
    } );
  }
}
