import { Entity }               from "../entity";
import { Emoji }                from "./emoji";
import { format_simple_entity } from "../../constants";
import { Method, Rest }         from "../../core/rest";
import { Dictionary }           from "../../dictionary";
import { log }                  from "../../logger";
import {
  APIApplication,
  APIEmoji,
  RESTGetAPIApplicationEmojisResult,
  RESTPatchCurrentApplicationJSONBody,
  RESTPostAPIApplicationEmojiJSONBody
}                               from "discord-api-types/v10";
import { Snowflake }            from "discord-api-types/v6";

/**
 * Represents a Discord Application entity with full control over its metadata
 * and application-level emojis.
 *
 * This class provides methods to manage the application itself, as well as
 * nested operations to manage custom emojis associated directly with the
 * application.
 *
 * @template Raw - The raw payload type of the application data. Defaults to
 *   {@link APIApplication}.
 */
export class Application<Raw extends APIApplication = APIApplication> extends Entity<Raw> {
  /**
   * Constructs a new instance of {@link Application}.
   *
   * @param rest - The {@link Rest} client used for API communication.
   * @param raw - The raw {@link APIApplication} payload from Discord.
   */
  constructor(public readonly rest: Rest, public readonly raw: Raw) {
    super( rest, raw, format_simple_entity( new.target.name, raw.id ) );
  }
  
  /**
   * Provides a grouped interface for managing application-level emojis.
   */
  public get emoji() {
    return {
      /**
       * Fetches the full list of emojis registered under this application.
       *
       * @returns A {@link Dictionary} mapping emoji IDs to {@link Emoji}
       *   instances.
       * @throws If the request fails, a structured error is thrown with
       *   context.
       */
      list : async () => {
        try {
          const API = await this.rest.request<RESTGetAPIApplicationEmojisResult>( {
            method : Method.GET,
            route : "applicationEmojis",
            args : [ this.raw.id ]
          } );
          
          return new Dictionary(
            API.items.map( emoji => [ emoji.id, new Emoji( this.rest, emoji ) ] )
          );
        } catch ( err ) {
          throw log.fail( this.format_name( "emoji.list" ), String( err ) ).error();
        }
      },
      
      /**
       * Fetches a specific emoji by ID from the application's emoji registry.
       *
       * @param id - The {@link Snowflake} ID of the emoji to fetch.
       * @returns An {@link Emoji} instance.
       * @throws If the emoji is not found or the request fails.
       */
      fetch : async (id: Snowflake) => {
        try {
          const API = await this.rest.request<APIEmoji>( {
            method : Method.GET,
            route : "applicationEmoji",
            args : [ this.raw.id, id ]
          } );
          
          return new Emoji( this.rest, API );
        } catch ( err ) {
          throw log.fail( this.format_name( "emoji.fetch" ), String( err ) ).error();
        }
      },
      
      /**
       * Creates a new emoji under the application.
       *
       * @param body - The request body containing the emoji's data (name,
       *   image, etc.).
       * @returns A new {@link Emoji} instance representing the created emoji.
       * @throws If the creation fails.
       */
      create : async (body: RESTPostAPIApplicationEmojiJSONBody) => {
        try {
          const API = await this.rest.request<APIEmoji>( {
            method : Method.POST,
            route : "applicationEmojis",
            args : [ this.raw.id ],
            body
          } );
          
          return new Emoji( this.rest, API );
        } catch ( err ) {
          throw log.fail( this.format_name( "emoji.create" ), String( err ) ).error();
        }
      },
      
      /**
       * Edits the name of an existing application emoji.
       *
       * @param id - The {@link Snowflake} ID of the emoji to edit.
       * @param name - The new name to assign to the emoji.
       * @returns An updated {@link Emoji} instance.
       * @throws If the update fails.
       */
      edit : async (id: Snowflake, name: string) => {
        try {
          const API = await this.rest.request<APIEmoji>( {
            method : Method.PATCH,
            route : "applicationEmoji",
            args : [ this.raw.id, id ],
            body : { name }
          } );
          
          return new Emoji( this.rest, API );
        } catch ( err ) {
          throw log.fail( this.format_name( "emoji.edit" ), String( err ) ).error();
        }
      },
      
      /**
       * Deletes a custom emoji registered to the application.
       *
       * @param id - The {@link Snowflake} ID of the emoji to delete.
       * @returns `true` if deletion succeeded; `false` if the request failed.
       */
      destroy : async (id: Snowflake) => {
        try {
          await this.rest.request<APIEmoji>( {
            method : Method.DELETE,
            route : "applicationEmoji",
            args : [ this.raw.id, id ]
          } );
          
          return true;
        } catch ( err ) {
          log.warn( this.format_name( "emoji.destroy" ), String( err ) );
          return false;
        }
      }
    };
  }
  
  /**
   * Re-fetches the current application metadata from Discord.
   *
   * @returns A new {@link Application} instance with updated metadata.
   * @throws If the request fails, a structured error is thrown.
   */
  override async fetch(): Promise<Application> {
    try {
      const API = await this.rest.request<APIApplication>( {
        method : Method.GET,
        route : "currentApplication"
      } );
      
      return new Application( this.rest, API );
    } catch ( err ) {
      throw log.fail( this.format_name( "fetch" ), String( err ) ).error();
    }
  }
  
  /**
   * Updates the current application metadata.
   *
   * @param body - A partial application object to patch.
   * @returns A new {@link Application} instance with the updated data.
   * @throws If the update request fails.
   */
  public async edit(body: RESTPatchCurrentApplicationJSONBody): Promise<Application> {
    try {
      const API = await this.rest.request<APIApplication, RESTPatchCurrentApplicationJSONBody>( {
        method : Method.PATCH,
        route : "currentApplication",
        body
      } );
      
      return new Application( this.rest, API );
    } catch ( err ) {
      throw log.fail( this.format_name( "fetch" ), String( err ) ).error();
    }
  }
}
