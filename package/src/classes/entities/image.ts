import {
  CDNRoutes,
  DefaultUserAvatarAssets,
  GuildBannerFormat,
  GuildIconFormat,
  ImageFormat,
  RoleIconFormat,
  UserAvatarFormat,
  UserBannerFormat
}                                    from "discord-api-types/v10";
import { CDN, format_simple_entity } from "../../constants";
import { Rest }                      from "../../core/rest";
import { Entity }                    from "../entity";

/**
 * A union type representing valid image sizes supported by the Discord CDN.
 * These sizes are powers of two, as required by Discord's API.
 */
export type Sizes = 16 | 32 | 64 | 128 | 256 | 512 | 1_024 | 2_048 | 4_096;

/**
 * A base interface describing the structure of a raw image object.
 */
export interface RawImage {
  /** Hash string identifying the image, or `null` if the image does not exist. */
  hash: string | null;
  
  /** ID of the user or entity that owns the image. */
  ownerId: string;
}

/**
 * An extension of RawImage for guild-scoped images (such as member avatars or
 * banners).
 */
export interface GuildRawImage extends RawImage {
  /** The guild ID associated with the image. */
  guildId: string;
}

/**
 * Abstract class that defines the structure and behavior for image
 * representations based on a hash. All concrete image types (user avatars,
 * banners, etc.) extend this class.
 *
 * @template Raw - A subtype of `RawImage` providing the required image data.
 */
export abstract class HashImage<Raw extends RawImage = RawImage> extends Entity<Raw> {
  /**
   * Constructs a new HashImage.
   *
   * @param rest - REST client instance used to perform HTTP operations.
   * @param raw - Raw image data, including hash and owner ID.
   * @param name - Human-readable or semantic name to help identify this entity
   *   type during logging.
   */
  protected constructor(public readonly rest: Rest, public readonly raw: Raw, name: string) {
    super( rest, raw, name );
  }
  
  /**
   * Returns the full URL to the image from the CDN, if available.
   * Must be implemented by subclasses.
   *
   * @param settings Optional image format and size.
   * @returns The image URL or `null` if the image doesn't exist.
   */
  public abstract url(settings?: {
    format?: ImageFormat;
    size?: Sizes;
  }): string | null;
  
  /**
   * Returns a fallback/default image URL.
   * Must be implemented by subclasses.
   *
   * @param settings Optional image format and size.
   * @returns A fallback image URL, or `undefined` if there is no default.
   */
  public abstract default(settings?: {
    format?: ImageFormat;
    size?: Sizes;
  }): undefined | string;
  
  /**
   * Returns a URL to display the image. Falls back to default or empty string.
   *
   * @param settings Optional image format and size.
   * @returns The image URL string.
   */
  public display(settings?: {
    format?: ImageFormat;
    size?: Sizes;
  }): string {
    return this.url( settings ) ?? this.default( settings ) ?? "";
  }
  
  /**
   * Fetches and returns the image as an ArrayBuffer from the resolved display
   * URL.
   *
   * @returns A promise that resolves to the binary content of the image.
   */
  public async buffer(): Promise<ArrayBuffer> {
    const RESPONSE = await fetch( this.display() );
    return await RESPONSE.arrayBuffer();
  }
}

// ----- USER AVATAR -----

/**
 * Represents a user avatar image.
 */
export class UserAvatar<Raw extends RawImage = RawImage> extends HashImage<Raw> {
  /**
   * Constructs a new UserAvatar.
   *
   * @param rest - REST client instance.
   * @param raw - User avatar data including hash and ownerId.
   */
  constructor(public readonly rest: Rest, public readonly raw: Raw) {
    super( rest, raw, format_simple_entity( new.target.name, raw.ownerId ) );
  }
  
  public override url(settings?: {
    format?: UserAvatarFormat;
    size?: Sizes;
  }): string | null {
    return this.raw.hash
      ? `${ CDN }${ CDNRoutes.userAvatar( this.raw.ownerId, this.raw.hash, settings?.format ?? ImageFormat.WebP ) }${ settings?.size ? `?size=${ settings?.size }` : "" }`
      : null;
  }
  
  public override default(settings?: {
    format?: ImageFormat;
    size?: Sizes;
  }): string {
    const INDEX = Number( (BigInt( this.raw.ownerId ) >> 22n) % 6n ) as DefaultUserAvatarAssets;
    return `${ CDN }${ CDNRoutes.defaultUserAvatar( INDEX ) }?size=${ settings?.size ?? 512 }` as const;
  }
}

// ----- USER BANNER -----

/**
 * Represents a user banner image.
 */
export class UserBanner<Raw extends RawImage = RawImage> extends HashImage<Raw> {
  /**
   * Constructs a new UserBanner.
   *
   * @param rest - REST client instance.
   * @param raw - User banner data including hash and ownerId.
   */
  constructor(public readonly rest: Rest, public readonly raw: Raw) {
    super( rest, raw, format_simple_entity( new.target.name, raw.ownerId ) );
  }
  
  public override url(settings?: {
    format?: UserBannerFormat;
    size?: Sizes;
  }): string | null {
    return this.raw.hash
      ? `${ CDN }${ CDNRoutes.userBanner( this.raw.ownerId, this.raw.hash, settings?.format ?? ImageFormat.WebP ) }${ settings?.size ? `?size=${ settings?.size }` : "" }`
      : null;
  }
  
  public override default(): undefined {
    return undefined;
  }
}

// ----- GUILD ICON -----

/**
 * Represents a guild icon image.
 */
export class GuildIcon<Raw extends RawImage = RawImage> extends HashImage<Raw> {
  /**
   * Constructs a new GuildIcon.
   *
   * @param rest - REST client instance.
   * @param raw - Guild icon data including hash and ownerId.
   */
  constructor(public readonly rest: Rest, public readonly raw: Raw) {
    super( rest, raw, format_simple_entity( new.target.name, raw.ownerId ) );
  }
  
  public override url(settings?: {
    format?: GuildIconFormat;
    size?: Sizes;
  }): string | null {
    return this.raw.hash
      ? `${ CDN }${ CDNRoutes.guildIcon( this.raw.ownerId, this.raw.hash, settings?.format ?? ImageFormat.WebP ) }${ settings?.size ? `?size=${ settings?.size }` : "" }`
      : null;
  }
  
  public override default(): undefined {
    return undefined;
  }
}

// ----- GUILD BANNER -----

/**
 * Represents a guild banner image.
 */
export class GuildBanner<Raw extends RawImage = RawImage> extends HashImage<Raw> {
  /**
   * Constructs a new GuildBanner.
   *
   * @param rest - REST client instance.
   * @param raw - Guild banner data including hash and ownerId.
   */
  constructor(public readonly rest: Rest, public readonly raw: Raw) {
    super( rest, raw, format_simple_entity( new.target.name, raw.ownerId ) );
  }
  
  public override url(settings?: {
    format?: GuildBannerFormat;
    size?: Sizes;
  }): string | null {
    return this.raw.hash
      ? `${ CDN }${ CDNRoutes.guildBanner( this.raw.ownerId, this.raw.hash, settings?.format ?? ImageFormat.WebP ) }${ settings?.size ? `?size=${ settings?.size }` : "" }`
      : null;
  }
  
  public override default(): undefined {
    return undefined;
  }
}

// ----- ROLE ICON -----

/**
 * Represents a role icon image in a guild.
 */
export class RoleIcon<Raw extends RawImage = RawImage> extends HashImage<Raw> {
  /**
   * Constructs a new RoleIcon.
   *
   * @param rest - REST client instance.
   * @param raw - Role icon data including hash and ownerId.
   */
  constructor(public readonly rest: Rest, public readonly raw: Raw) {
    super( rest, raw, format_simple_entity( new.target.name, raw.ownerId ) );
  }
  
  public override url(settings?: {
    format?: RoleIconFormat;
    size?: Sizes;
  }): string | null {
    return this.raw.hash
      ? `${ CDN }${ CDNRoutes.roleIcon( this.raw.ownerId, this.raw.hash, settings?.format ?? ImageFormat.WebP ) }${ settings?.size ? `?size=${ settings?.size }` : "" }`
      : null;
  }
  
  public override default(): undefined {
    return undefined;
  }
}

// ----- MEMBER AVATAR -----

/**
 * Represents a guild member's avatar image (custom per-guild avatar).
 */
export class MemberAvatar<Raw extends GuildRawImage = GuildRawImage> extends HashImage<Raw> {
  /**
   * Constructs a new MemberAvatar.
   *
   * @param rest - REST client instance.
   * @param raw - Member avatar data including hash, ownerId and guildId.
   */
  constructor(public readonly rest: Rest, public readonly raw: Raw) {
    super( rest, raw, format_simple_entity( new.target.name, raw.ownerId ) );
  }
  
  public override url(settings?: {
    format?: UserAvatarFormat;
    size?: Sizes;
  }): string | null {
    return this.raw.hash
      ? `${ CDN }${ CDNRoutes.guildMemberAvatar( this.raw.guildId, this.raw.ownerId, this.raw.hash, settings?.format ?? ImageFormat.WebP ) }${ settings?.size ? `?size=${ settings?.size }` : "" }`
      : null;
  }
  
  public override default(): undefined {
    return undefined;
  }
}

// ----- MEMBER BANNER -----

/**
 * Represents a guild member's banner image (custom per-guild banner).
 */
export class MemberBanner<Raw extends GuildRawImage = GuildRawImage> extends HashImage<Raw> {
  /**
   * Constructs a new MemberBanner.
   *
   * @param rest - REST client instance.
   * @param raw - Member banner data including hash, ownerId and guildId.
   */
  constructor(public readonly rest: Rest, public readonly raw: Raw) {
    super( rest, raw, format_simple_entity( new.target.name, raw.ownerId ) );
  }
  
  public override url(settings?: {
    format?: UserBannerFormat;
    size?: Sizes;
  }): string | null {
    return this.raw.hash
      ? `${ CDN }${ CDNRoutes.guildMemberBanner( this.raw.guildId, this.raw.ownerId, this.raw.hash, settings?.format ?? ImageFormat.WebP ) }${ settings?.size ? `?size=${ settings?.size }` : "" }`
      : null;
  }
  
  public override default(): undefined {
    return undefined;
  }
}