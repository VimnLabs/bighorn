import {
  APIGuild,
  APIGuildMember,
  APIInteractionGuildMember,
  APIVoiceState,
  RESTPatchAPIGuildMemberJSONBody
} from "discord-api-types/v10";
import {
  ENTITY_MESSAGES,
  format_entity_with_sub,
  KEYWORDS,
  replace
} from "../../constants";
import {
  Method,
  Rest
} from "../../core/rest";
import {
  log
} from "../../logger";
import {
  Entity
} from "../entity";
import {
  Guild
} from "./guild";
import {
  MemberAvatar,
  MemberBanner
} from "./image";
import {
  User
} from "./user";

/**
 * Represents a union type for any guild member payload received from Discord.
 *
 * This type can refer either to a full guild member object (`APIGuildMember`),
 * typically returned from REST endpoints like `GET
 * /guilds/{guild.id}/members/{user.id}`, or to a partial guild member object
 * (`APIInteractionGuildMember`) received within interaction payloads, which
 * lacks full member data such as `joined_at` or `roles` array.
 *
 * @see {@link APIGuildMember} - Full member structure used in REST responses.
 * @see {@link APIInteractionGuildMember} - Partial member structure used in
 *   interactions.
 */
export type RawMember = APIInteractionGuildMember | APIGuildMember;

/**
 * Represents a Discord Guild Member.
 *
 * Wraps the `APIGuildMember` raw data with additional utility methods to
 * access member-specific resources like avatars and banners,
 * perform API fetch and modification, and retrieve voice state.
 *
 * @template Raw - Type override for the raw guild member data.
 */
export class Member<Raw extends RawMember = RawMember> extends Entity<Raw> {
  /** The Discord User associated with this member; may be null in edge cases. */
  public readonly user: User | null;
  
  /** The Guild to which this member belongs. */
  public readonly guild: Guild;
  
  /**
   * Creates a new Member instance.
   *
   * @param rest - REST client instance for API calls.
   * @param raw - The raw guild member data from Discord API.
   * @param guild_raw - The raw guild data to which this member belongs.
   */
  constructor(
    public readonly rest: Rest,
    public readonly raw: Raw,
    guild_raw: APIGuild
  ) {
    super( rest, raw, format_entity_with_sub( new.target.name, guild_raw.id, raw.user?.id ?? "unknown" ) );
    this.user = raw.user ? new User( rest, raw.user ) : null;
    this.guild = new Guild( rest, guild_raw );
  }
  
  /**
   * Returns the timestamp when the member joined the guild as a Date object.
   */
  public get joined(): Date {
    return new Date( this.raw.joined_at );
  }
  
  /**
   * Returns the date the member started boosting the guild, or null if not
   * boosting.
   */
  public get premium(): Date | null {
    return this.raw.premium_since ? new Date( this.raw.premium_since ) : null;
  }
  
  /**
   * Retrieves the member's guild-specific banner.
   *
   * Logs a warning if the member does not have a banner.
   *
   * @returns A `MemberBanner` instance representing the banner resource.
   */
  public banner(): MemberBanner {
    if ( this.raw.banner === null )
      log.warn( this.name, replace( ENTITY_MESSAGES.NO_HASH, {
        [KEYWORDS.Kind] : "custom banner"
      } ) );
    
    return new MemberBanner( this.rest, {
      hash : this.raw.banner ?? null,
      ownerId : this.raw.user.id,
      guildId : this.guild.raw.id
    } );
  }
  
  /**
   * Retrieves the member's guild-specific avatar.
   *
   * Logs a warning if the member does not have a custom avatar.
   *
   * @returns A `MemberAvatar` instance representing the avatar resource.
   */
  public avatar(): MemberAvatar {
    if ( this.raw.avatar === null )
      log.warn( this.name, replace( ENTITY_MESSAGES.NO_HASH, {
        [KEYWORDS.Kind] : "custom avatar"
      } ) );
    
    return new MemberAvatar( this.rest, {
      hash : this.raw.avatar ?? null,
      ownerId : this.raw.user.id,
      guildId : this.guild.raw.id
    } );
  }
  
  /**
   * Fetches the latest member data from the Discord API.
   *
   * @returns A Promise resolving to an updated `Member` instance.
   * @throws Throws and logs an error if the fetch fails.
   */
  public async fetch(): Promise<Member> {
    try {
      const API = await this.rest.request<APIGuildMember>( {
        method : Method.GET,
        route : "guildMember",
        args : [ this.guild.raw.id, this.raw.user.id ]
      } );
      return new Member( this.rest, API, this.guild.raw );
    } catch ( err ) {
      throw log.fail( this.format_name( "fetch" ), String( err ) ).error();
    }
  }
  
  /**
   * Modifies this member's data in the guild via the Discord API.
   *
   * @param data - Partial update payload for the guild member.
   * @param reason - Optional audit log reason for the modification.
   * @returns A Promise resolving to an updated `Member` instance.
   * @throws Throws and logs an error if the modification fails.
   */
  public async modify(data: RESTPatchAPIGuildMemberJSONBody, reason?: string): Promise<Member> {
    try {
      const API = await this.rest.request<APIGuildMember>( {
        method : Method.PATCH,
        route : "guildMember",
        args : [ this.guild.raw.id, this.raw.user.id ],
        body : data,
        reason
      } );
      return new Member( this.rest, API, this.guild.raw );
    } catch ( err ) {
      throw log.fail( this.format_name( "modify" ), String( err ) ).error();
    }
  }
  
  /**
   * Retrieves the voice state of this member in the guild.
   *
   * @returns A Promise resolving to the member's `APIVoiceState`.
   * @throws Throws and logs an error if the request fails.
   */
  public async voice(): Promise<APIVoiceState> {
    try {
      return await this.rest.request<APIVoiceState>( {
        method : Method.GET,
        route : "guildVoiceState",
        args : [ this.guild.raw.id, this.raw.user.id ]
      } );
    } catch ( err ) {
      throw log.fail( this.format_name( "voice" ), String( err ) ).error();
    }
  }
}
