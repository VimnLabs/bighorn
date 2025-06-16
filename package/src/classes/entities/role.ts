import { Entity } from "@entity";
import { Guild } from "@src/classes/entities/guild";
import { RoleIcon } from "@src/classes/entities/image";
import { format_entity_with_sub } from "@src/constants";
import { Method, Rest } from "@src/core/rest";
import { log } from "@src/logger";
import {
  APIGuild,
  APIRole,
  RESTPatchAPIGuildRoleJSONBody
} from "discord-api-types/v10";

/**
 * Represents a Discord role within a guild.
 *
 * This class wraps the raw `APIRole` object and exposes utilities to fetch,
 * edit, and delete roles, as well as access guild-specific context.
 *
 * @template Raw - The raw type of the role, defaulting to `APIRole`.
 */
export class Role<Raw extends APIRole = APIRole> extends Entity<Raw> {
  /**
   * Guild to which this role belongs.
   */
  public readonly guild: Guild;
  
  /**
   * Constructs a new Role instance.
   *
   * @param rest - The REST client used to communicate with Discord's API.
   * @param raw - The raw `APIRole` data.
   * @param guild_raw - The raw `APIGuild` data to associate the role with.
   */
  constructor(
    public readonly rest: Rest,
    public readonly raw: Raw,
    guild_raw: APIGuild
  ) {
    super(rest, raw, format_entity_with_sub(new.target.name, guild_raw.id, raw.id));
    this.guild = new Guild(rest, guild_raw);
  }
  
  /**
   * Returns an image entity for the role's icon.
   *
   * @returns A `RoleIcon` instance representing the role icon.
   */
  public icon(): RoleIcon {
    return new RoleIcon(this.rest, {
      hash: this.raw.icon ?? null,
      ownerId: this.raw.id
    });
  }
  
  /**
   * Fetches the latest state of this role from the Discord API.
   *
   * @returns A fresh `Role` instance.
   */
  public async fetch(): Promise<Role> {
    try {
      const API = await this.rest.request<APIRole>({
        method: Method.GET,
        route: "guildRole",
        args: [this.guild.raw.id, this.raw.id]
      });
      return new Role(this.rest, API, this.guild.raw);
    } catch (err) {
      throw log.fail(this.format_name("fetch"), String(err)).error();
    }
  }
  
  /**
   * Edits this role's configuration in the guild.
   *
   * Supports both role metadata and position updates.
   *
   * @param data - The role configuration changes to apply.
   * @param reason - Optional reason for audit logs.
   * @returns A new `Role` instance with the updated data.
   */
  public async edit(
    data: RESTPatchAPIGuildRoleJSONBody & {
      /** Sorting position of the role (roles with the same position are sorted by ID). */
      position?: number;
    },
    reason?: string
  ): Promise<Role> {
    try {
      // Handle role position updates separately via the `guildRoles` route
      if ("position" in data) {
        await this.rest.request({
          method: Method.PATCH,
          route: "guildRoles",
          args: [this.guild.raw.id],
          body: {
            id: this.raw.id,
            position: data.position
          },
          reason
        });
      }
      
      const API = await this.rest.request<APIRole>({
        method: Method.PATCH,
        route: "guildRole",
        args: [this.guild.raw.id, this.raw.id],
        body: data,
        reason
      });
      return new Role(this.rest, API, this.guild.raw);
    } catch (err) {
      throw log.fail(this.format_name("edit"), String(err)).error();
    }
  }
  
  /**
   * Deletes this role from the guild.
   *
   * @param reason - Optional reason for audit logging.
   * @returns `true` if deletion succeeded, `false` if an error occurred.
   */
  public async destroy(reason?: string): Promise<boolean> {
    try {
      await this.rest.request({
        method: Method.DELETE,
        route: "guildRole",
        args: [this.guild.raw.id, this.raw.id],
        reason
      });
      return true;
    } catch (err) {
      throw log.fail(this.format_name("destroy"), String(err)).error();
    }
  }
}
